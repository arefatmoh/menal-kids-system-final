export interface FriendlyPgError {
  status: number
  message: string
  code?: string
}

export function getFriendlyPgError(error: unknown): FriendlyPgError {
  const e = error as { code?: string; detail?: string; message?: string; constraint?: string }
  const code = e?.code

  switch (code) {
    case "23503": // foreign_key_violation
      return { status: 409, message: "Cannot delete or update: this record is referenced by other data.", code }
    case "23505": // unique_violation
      return { status: 409, message: "A record with the same unique value already exists.", code }
    case "23502": // not_null_violation
      return { status: 400, message: "A required field is missing.", code }
    case "23514": // check_violation
      return { status: 400, message: "One or more values violate a constraint.", code }
    case "22P02": // invalid_text_representation (e.g., invalid UUID)
      return { status: 400, message: "Invalid value format for one of the fields.", code }
    case "42703": // undefined_column
      return { status: 400, message: "Unknown column in request.", code }
    case "42P01": // undefined_table
      return { status: 400, message: "Unknown table.", code }
    case "42804": // datatype_mismatch
      return { status: 400, message: "Invalid data type for one of the fields.", code }
    default:
      return { status: 500, message: "Operation failed. Please try again or contact support.", code }
  }
}


