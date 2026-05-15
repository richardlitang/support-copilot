# Exports Troubleshooting Guide

## Common export failures

If an export fails immediately after setup, check whether the workspace has completed the required billing setup and whether the export actor has `Exports: Write` permission. Missing either prerequisite blocks export job creation.

## Permissions required

The user or API token that runs exports must have `Exports: Write` and `Data: Read`. Read-only access can browse reports but cannot create new export jobs.

## Retry guidance

After correcting setup or permissions, retry the export once. If the second attempt still fails, gather the job ID and escalate to engineering with the timestamps from the failed run.
