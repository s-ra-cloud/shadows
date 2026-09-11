---
name: Daily report delivery tradeoff
description: Why daily Hunter delivery favors duplicate prevention over blind retry
---
Daily Hunter should favor avoiding duplicate hunts and duplicate emails over retrying an uncertain external operation.

**Why:** Gmail sending is not transactionally coupled to the application's database. A connection failure after submission can mean the email was sent even without a recorded receipt; automatic retry could send it twice.

**How to apply:** Preserve ambiguous delivery for editor investigation, and do not describe this as guaranteed exactly-once delivery. Keep scheduled execution separate from the web deployment rather than replacing the web app with a scheduled target.