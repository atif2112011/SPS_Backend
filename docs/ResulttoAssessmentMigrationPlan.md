# Results to Assessments & Achievements

## What changed

`Result` is replaced for all new writes by `Assessment`. Report cards remain separate, formal term-based documents. Assessments are always created for one student at a time.

## Assessment contract

`POST`, `GET`, `PATCH`, and soft-delete operations are available at `/api/v1/assessments`.

Required fields are `studentId`, `classId`, `title`, `category`, and `eventDate`. Categories are `academic_assessment`, `achievement`, and `other`.

- Academic assessments require `academicYear` and may have `subjectMarks`, `overallGrade`, and `rank`.
- Achievements and other records may have `outcome`, `score`, `maxScore`, `grade`, and `rank`.
- Every record may have remarks and up to three JPG, PNG, GIF, WebP, or PDF attachments, limited to 4 MB combined.

## Existing data

Run `npm run migrate:results-to-assessments` from `sps-api` after deploying the Assessment model. The migration is idempotent: it stores the original `_id` as `legacyResultId` and skips records already copied. Every migrated record becomes an `academic_assessment`, preserving student, class, creator, marks, year, grade, rank, remarks, soft-delete state, and timestamps.

## Compatibility window

`/results` remains read-only for installed older Student App builds. It reads migrated academic assessments and maps `title` back to `examName`. POST, PATCH, and DELETE on `/results` now return HTTP 410. New clients must only use `/assessments`.

## Student App integration

Fetch `GET /assessments/student/:studentId` instead of Results. Show records under **Assessments & Achievements** with category filtering and title/date/rank sorting. Academic records display subject marks; Achievement and Other records display outcome, score, grade/rank, remarks, and attachments. Notification payloads now use `type: "assessment"` and `entityType: "Assessment"`.

## Retired field

`StudentProfile.resultSummary` is retained only as legacy stored data. It is no longer accepted or written by student update APIs.
