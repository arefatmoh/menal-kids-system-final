-- Enhance restore_activity to perform real effects for sales

DROP FUNCTION IF EXISTS restore_activity(UUID, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION restore_activity(
  p_activity_id UUID,
  p_actor_id TEXT,
  p_reason TEXT DEFAULT 'User-initiated restore'
)
RETURNS TABLE (
  restored BOOLEAN,
  original_id UUID,
  restore_id UUID,
  message TEXT
) AS $$
DECLARE
  v_activity RECORD;
  v_restore_id UUID;
  v_refund_id UUID;
  v_refund_amount NUMERIC := 0;
  r RECORD;
BEGIN
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, p_activity_id, NULL::UUID, 'Activity not found';
    RETURN;
  END IF;

  IF v_activity.status = 'reversed' THEN
    RETURN QUERY SELECT false, v_activity.id, NULL::UUID, 'Activity already reversed';
    RETURN;
  END IF;

  -- Handle restore by type
  IF v_activity.type = 'sell' THEN
    -- Restock inventory for the sale items and record movements
    -- Use sale items from the referenced sale when possible; otherwise fallback to delta.items
    IF v_activity.related_entity_type = 'sale' AND v_activity.related_entity_id IS NOT NULL THEN
      -- Add back each sold item to inventory
      FOR r IN (
        SELECT si.product_id, si.variation_id, si.quantity
        FROM sale_items si WHERE si.sale_id = v_activity.related_entity_id
      ) LOOP
        -- Try update existing inventory row
        UPDATE inventory SET quantity = quantity + r.quantity, updated_at = NOW()
        WHERE product_id = r.product_id
          AND branch_id = v_activity.branch_id
          AND (
            (r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR
            (r.variation_id IS NULL AND variation_id IS NULL)
          );

        IF NOT FOUND THEN
          -- Insert new inventory row if missing
          INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level)
          VALUES (r.product_id, v_activity.branch_id, r.variation_id, r.quantity, 5, 100)
          ON CONFLICT DO NOTHING;
        END IF;

        -- Record stock movement (in)
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, v_activity.branch_id, r.variation_id, p_actor_id::uuid, 'in', r.quantity, 'Restore sale', 'sale_restore', v_activity.related_entity_id);
      END LOOP;

      -- Remove the sale transaction so reports reflect reversal
      -- Idempotent: if already deleted, these will affect 0 rows
      DELETE FROM sale_items WHERE sale_id = v_activity.related_entity_id;
      DELETE FROM sales WHERE id = v_activity.related_entity_id;
    ELSIF v_activity.delta ? 'items' THEN
      -- Fallback: use delta items array
      FOR r IN (
        SELECT (item->>'product_id')::uuid AS product_id,
               NULLIF(item->>'variation_id','')::uuid AS variation_id,
               (item->>'quantity')::int AS quantity
        FROM jsonb_array_elements(v_activity.delta->'items') AS item
      ) LOOP
        UPDATE inventory SET quantity = quantity + r.quantity, updated_at = NOW()
        WHERE product_id = r.product_id
          AND branch_id = v_activity.branch_id
          AND (
            (r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR
            (r.variation_id IS NULL AND variation_id IS NULL)
          );
        IF NOT FOUND THEN
          INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level)
          VALUES (r.product_id, v_activity.branch_id, r.variation_id, r.quantity, 5, 100)
          ON CONFLICT DO NOTHING;
        END IF;
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, v_activity.branch_id, r.variation_id, p_actor_id::uuid, 'in', r.quantity, 'Restore sale', 'sale_restore', v_activity.related_entity_id);
      END LOOP;
    END IF;

    -- Log refund activity (for reporting adjustments later)
    IF v_activity.delta ? 'total_amount' THEN
      v_refund_amount := COALESCE( (v_activity.delta->>'total_amount')::numeric, 0);
    END IF;

    INSERT INTO activities (
      type, title, description, status,
      branch_id, user_id,
      related_entity_type, related_entity_id,
      delta, metadata, parent_activity_id
    )
    VALUES (
      'refund',
      CONCAT('Refund for sale ', COALESCE(v_activity.related_entity_id::text, '')),
      p_reason,
      'completed',
      v_activity.branch_id,
      p_actor_id,
      'sale',
      v_activity.related_entity_id,
      jsonb_build_object('amount', -v_refund_amount),
      jsonb_build_object('source_activity', v_activity.id),
      v_activity.id
    ) RETURNING id INTO v_refund_id;
  ELSIF v_activity.type = 'expense_add' THEN
    -- Minimal: log cancel; deeper accounting can be added later
    -- Delete the expense row to reflect cancellation in reports if present
    IF v_activity.related_entity_type = 'expense' AND v_activity.related_entity_id IS NOT NULL THEN
      DELETE FROM expenses WHERE id = v_activity.related_entity_id;
    END IF;
    INSERT INTO activities (type, title, description, status, branch_id, user_id, related_entity_type, related_entity_id, delta, metadata, parent_activity_id)
    VALUES ('restore', 'Cancel expense', p_reason, 'completed', v_activity.branch_id, p_actor_id, 'expense', v_activity.related_entity_id,
            jsonb_build_object('canceled', true), jsonb_build_object('source_activity', v_activity.id), v_activity.id)
    RETURNING id INTO v_refund_id;
  ELSIF v_activity.type = 'transfer' THEN
    -- Reverse transfer: move items back from destination to source
    -- We expect delta to contain items and to_branch_id; branch_id is the source
    IF v_activity.delta ? 'items' AND v_activity.delta ? 'to_branch_id' THEN
      FOR r IN (
        SELECT (item->>'product_id')::uuid AS product_id,
               NULLIF(item->>'variation_id','')::uuid AS variation_id,
               (item->>'quantity')::int AS quantity,
               (v_activity.delta->>'to_branch_id')::text AS to_branch
        FROM jsonb_array_elements(v_activity.delta->'items') AS item
      ) LOOP
        -- Decrement destination
        UPDATE inventory SET quantity = GREATEST(quantity - r.quantity, 0), updated_at = NOW()
        WHERE product_id = r.product_id AND branch_id = r.to_branch
          AND ((r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR (r.variation_id IS NULL AND variation_id IS NULL));
        -- Increment source
        UPDATE inventory SET quantity = quantity + r.quantity, updated_at = NOW()
        WHERE product_id = r.product_id AND branch_id = v_activity.branch_id
          AND ((r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR (r.variation_id IS NULL AND variation_id IS NULL));
        IF NOT FOUND THEN
          INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level)
          VALUES (r.product_id, v_activity.branch_id, r.variation_id, r.quantity, 5, 100)
          ON CONFLICT DO NOTHING;
        END IF;
        -- Movements
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, r.to_branch, r.variation_id, p_actor_id::uuid, 'out', r.quantity, 'Restore transfer', 'transfer_restore', v_activity.related_entity_id);
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, v_activity.branch_id, r.variation_id, p_actor_id::uuid, 'in', r.quantity, 'Restore transfer', 'transfer_restore', v_activity.related_entity_id);
      END LOOP;
    END IF;
    -- Remove original transfer rows if present
    IF v_activity.related_entity_type = 'transfer' AND v_activity.related_entity_id IS NOT NULL THEN
      DELETE FROM transfer_items WHERE transfer_id = v_activity.related_entity_id;
      DELETE FROM transfers WHERE id = v_activity.related_entity_id;
    END IF;
  ELSIF v_activity.type = 'stock_add' THEN
    -- Decrement same quantities to undo the add (no negative)
    IF v_activity.delta ? 'items' THEN
      FOR r IN (
        SELECT (item->>'product_id')::uuid AS product_id,
               NULLIF(item->>'variation_id','')::uuid AS variation_id,
               (item->>'quantity')::int AS quantity
        FROM jsonb_array_elements(v_activity.delta->'items') AS item
      ) LOOP
        UPDATE inventory SET quantity = GREATEST(quantity - r.quantity, 0), updated_at = NOW()
        WHERE product_id = r.product_id AND branch_id = v_activity.branch_id
          AND ((r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR (r.variation_id IS NULL AND variation_id IS NULL));
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, v_activity.branch_id, r.variation_id, p_actor_id::uuid, 'out', r.quantity, 'Restore stock add', 'stock_add_restore', v_activity.id);
      END LOOP;
    END IF;
  ELSIF v_activity.type = 'stock_reduce' THEN
    -- Increment same quantities back
    IF v_activity.delta ? 'items' THEN
      FOR r IN (
        SELECT (item->>'product_id')::uuid AS product_id,
               NULLIF(item->>'variation_id','')::uuid AS variation_id,
               (item->>'quantity')::int AS quantity
        FROM jsonb_array_elements(v_activity.delta->'items') AS item
      ) LOOP
        UPDATE inventory SET quantity = quantity + r.quantity, updated_at = NOW()
        WHERE product_id = r.product_id AND branch_id = v_activity.branch_id
          AND ((r.variation_id IS NOT NULL AND variation_id = r.variation_id) OR (r.variation_id IS NULL AND variation_id IS NULL));
        IF NOT FOUND THEN
          INSERT INTO inventory (product_id, branch_id, variation_id, quantity, min_stock_level, max_stock_level)
          VALUES (r.product_id, v_activity.branch_id, r.variation_id, r.quantity, 5, 100)
          ON CONFLICT DO NOTHING;
        END IF;
        INSERT INTO stock_movements (product_id, branch_id, variation_id, user_id, movement_type, quantity, reason, reference_type, reference_id)
        VALUES (r.product_id, v_activity.branch_id, r.variation_id, p_actor_id::uuid, 'in', r.quantity, 'Restore stock reduce', 'stock_reduce_restore', v_activity.id);
      END LOOP;
    END IF;
  END IF;

  -- Flip original activity status
  UPDATE activities SET status = 'reversed' WHERE id = v_activity.id;

  -- Log a restore wrapper
  INSERT INTO activities (
    type, title, description, status,
    branch_id, user_id,
    related_entity_type, related_entity_id,
    delta, metadata, parent_activity_id
  )
  VALUES (
    'restore',
    CONCAT('Restore: ', COALESCE(v_activity.title, v_activity.type)),
    p_reason,
    'completed',
    v_activity.branch_id,
    p_actor_id,
    v_activity.related_entity_type,
    v_activity.related_entity_id,
    jsonb_build_object('restored_activity_id', v_activity.id, 'original_type', v_activity.type, 'refund_activity_id', v_refund_id),
    jsonb_build_object('reason', p_reason),
    v_activity.id
  )
  RETURNING id INTO v_restore_id;

  RETURN QUERY SELECT true, v_activity.id, v_restore_id, 'Restore applied';
END;
$$ LANGUAGE plpgsql VOLATILE;


