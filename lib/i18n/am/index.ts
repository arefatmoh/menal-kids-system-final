import common from "./common"
import auth from "./auth"
import navigation from "./navigation"
import dashboard from "./dashboard"
import branch from "./branch"
import time from "./time"
import transfers from "./transfers"
import products from "./products"
import reports from "./reports"

const am = {
  ...auth,
  ...navigation,
  ...dashboard,
  ...branch,
  ...common,
  ...time,
  ...transfers,
  ...products,
  ...reports,
}

export default am


