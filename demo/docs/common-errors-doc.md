# Common Errors Doc

## ERR-219

ERR-219 indicates a permissions mismatch between the actor and the requested job. It appears most often when the actor has read access but lacks write access for exports.

## ERR-318

ERR-318 indicates that a plan restriction blocked the requested workflow. Confirm the feature is included in the customer plan before escalating.

## Escalation notes

If the docs point to both a plan issue and a permissions issue, resolve the plan entitlement first and then retry with a correctly scoped actor.
