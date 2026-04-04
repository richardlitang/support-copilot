# CSV Import Guide

## Basic import requirements
The first row must contain headers, and email is required for contact imports.

## Large import behavior
Imports larger than 50,000 rows are processed in batches. If a batch fails validation, the whole import is paused and the user receives a validation report.

## Recommended first check
When an import stalls, confirm the row count and whether the workspace plan supports that import size.
