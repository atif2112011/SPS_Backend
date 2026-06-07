$baseUrl = "http://localhost:5000/api/v1"
$results = [System.Collections.Generic.List[object]]::new()
$adminToken = $null; $teacherToken = $null; $studentToken = $null
$p3ClassId = $null; $studentUserId = $null; $teacherUserId = $null
$noticeId = $null; $assignmentId = $null; $timetableId = $null
$reportCardId = $null; $resultId = $null

# ── Cleanup Phase 3 test data ─────────────────────────────────────────────────
Write-Host "Cleaning up Phase 3 test data..." -ForegroundColor DarkGray
$cleanupScript = @"
require('dotenv').config();
const mongoose = require('mongoose');
async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Notice      = require('./src/models/Notice.model');
  const Assignment  = require('./src/models/Assignment.model');
  const Timetable   = require('./src/models/Timetable.model');
  const ReportCard  = require('./src/models/ReportCard.model');
  const Result      = require('./src/models/Result.model');
  const Class       = require('./src/models/Class.model');
  await Notice.deleteMany({});
  await Assignment.deleteMany({});
  await Timetable.deleteMany({});
  await ReportCard.deleteMany({});
  await Result.deleteMany({});
  await Class.deleteMany({ className: '10-P3' });
  console.log('Phase 3 cleanup done');
  await mongoose.disconnect();
}
cleanup().catch(e => { console.error(e.message); process.exit(1); });
"@
$cleanupScript | Set-Content -Path "$PSScriptRoot\cleanup-p3.js" -Encoding utf8
node "$PSScriptRoot\cleanup-p3.js"
Remove-Item "$PSScriptRoot\cleanup-p3.js" -Force -ErrorAction SilentlyContinue
Write-Host "Cleanup done. Waiting for server..." -ForegroundColor DarkGray
Start-Sleep -Seconds 1

# ── Helpers ───────────────────────────────────────────────────────────────────
function Call3 {
  param($Method, $Path, $Body, $Token, $ContentType = "application/json")
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $params = @{
    Uri         = "$baseUrl$Path"
    Method      = $Method
    Headers     = $headers
    ContentType = $ContentType
    ErrorAction = "SilentlyContinue"
  }
  if ($Body -and $ContentType -eq "application/json") {
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }
  try {
    return Invoke-RestMethod @params
  } catch {
    $raw = $_.ErrorDetails.Message
    if ($raw) {
      try { return $raw | ConvertFrom-Json } catch { return [PSCustomObject]@{ success = $false; message = $_.Exception.Message; errorCode = $null } }
    }
    return [PSCustomObject]@{ success = $false; message = $_.Exception.Message; errorCode = $null }
  }
}

function Test-Case {
  param($label, $response, $expectedSuccess, $expectedMsgOrCode = $null)
  $pass = ([bool]$response.success) -eq $expectedSuccess
  if ($pass -and $expectedMsgOrCode) {
    $pass = ($response.message -like "*$expectedMsgOrCode*") -or ($response.errorCode -eq $expectedMsgOrCode)
  }
  $script:results.Add([PSCustomObject]@{
    Label = $label
    Pass  = $pass
    Got   = "$($response.message) | $($response.errorCode)"
  })
}

Write-Host ""
Write-Host "Running Phase 3 tests..." -ForegroundColor Cyan

# ── [T01] Admin login ─────────────────────────────────────────────────────────
$r = Call3 GET "/auth/me" $null $null
$loginR = Call3 POST "/auth/login" @{ username = "admin_test"; password = "Test@1234" } $null
Test-Case "[T01] Admin login" $loginR $true "Login"
$adminToken = $loginR.data.accessToken

# ── [T02] Teacher login ───────────────────────────────────────────────────────
$tLoginR = Call3 POST "/auth/login" @{ username = "teacher_test"; password = "Test@1234" } $null
Test-Case "[T02] Teacher login" $tLoginR $true "Login"
$teacherToken = $tLoginR.data.accessToken

# ── [T03] Student login ───────────────────────────────────────────────────────
$sLoginR = Call3 POST "/auth/login" @{ username = "student_test"; password = "Test@1234" } $null
Test-Case "[T03] Student login" $sLoginR $true "Login"
$studentToken = $sLoginR.data.accessToken

# ── [T04] Get student userId ──────────────────────────────────────────────────
$studentsR = Call3 GET "/students?search=student_test" $null $adminToken
$studentUserId = ($studentsR.data | Where-Object { $_.username -eq "student_test" } | Select-Object -First 1)._id
Test-Case "[T04] Student userId resolved" ([PSCustomObject]@{ success = ($null -ne $studentUserId); message = "userId: $studentUserId" }) $true

# ── [T05] Create class for Phase 3 ───────────────────────────────────────────
$classR = Call3 POST "/classes" @{ className = "10-P3"; section = "A"; academicYear = "2025-26" } $adminToken
if ($classR.success) {
  $p3ClassId = $classR.data._id
} else {
  # Class might already exist — fetch it
  $classList = Call3 GET "/classes?search=10-P3" $null $adminToken
  $p3ClassId = ($classList.data.classes | Where-Object { $_.className -eq "10-P3" } | Select-Object -First 1)._id
}
Test-Case "[T05] Phase 3 class ready" ([PSCustomObject]@{ success = ($null -ne $p3ClassId); message = "classId: $p3ClassId" }) $true

# ── [T06] Assign teacher to class ────────────────────────────────────────────
$teachersR = Call3 GET "/teachers?search=teacher_test" $null $adminToken
$teacherUserId = ($teachersR.data | Where-Object { $_.username -eq "teacher_test" } | Select-Object -First 1)._id
$assignR = Call3 PATCH "/classes/$p3ClassId/teacher" @{ teacherId = $teacherUserId } $adminToken
Test-Case "[T06] Assign teacher to class" $assignR $true "Teacher assigned"

# ── [T07] Add student to class ────────────────────────────────────────────────
$addR = Call3 PATCH "/classes/$p3ClassId/members" @{ action = "add"; studentIds = @($studentUserId) } $adminToken
Test-Case "[T07] Add student to class" $addR $true "added"

# Teacher needs fresh token after assignment
$tLoginR2 = Call3 POST "/auth/login" @{ username = "teacher_test"; password = "Test@1234" } $null
$teacherToken = $tLoginR2.data.accessToken

# ══ NOTICE TESTS ══════════════════════════════════════════════════════════════

# [T08] Admin creates all_classes notice
$r08 = Call3 POST "/notices" @{ title = "Admin Global Notice"; message = "Hello everyone!"; audienceType = "all_classes" } $adminToken
Test-Case "[T08] Admin creates all_classes notice" $r08 $true "created"

# [T09] Teacher creates notice for their class
$r09 = Call3 POST "/notices" @{ title = "Teacher Class Notice"; message = "Homework due tomorrow."; audienceType = "specific_classes"; classIds = @($p3ClassId) } $teacherToken
Test-Case "[T09] Teacher creates class notice" $r09 $true "created"
if ($r09.success) { $noticeId = $r09.data._id }

# [T10] Teacher creates notice with audienceType=specific_classes but no classIds → VALIDATION_ERROR
$r10 = Call3 POST "/notices" @{ title = "Bad Notice"; message = "Missing classIds"; audienceType = "specific_classes" } $teacherToken
Test-Case "[T10] Missing classIds → VALIDATION_ERROR" $r10 $false "VALIDATION_ERROR"

# [T11] Student cannot create notice → UNAUTHORIZED
$r11 = Call3 POST "/notices" @{ title = "Student Notice"; message = "No."; audienceType = "all_classes" } $studentToken
Test-Case "[T11] Student cannot create notice" $r11 $false "UNAUTHORIZED"

# [T12] Admin lists all notices
$r12 = Call3 GET "/notices" $null $adminToken
Test-Case "[T12] Admin lists notices" $r12 $true "fetched"

# [T13] Teacher lists notices (scoped to class)
$r13 = Call3 GET "/notices" $null $teacherToken
Test-Case "[T13] Teacher lists notices" $r13 $true "fetched"

# [T14] Student lists notices
$r14 = Call3 GET "/notices" $null $studentToken
Test-Case "[T14] Student lists notices" $r14 $true "fetched"

# [T15] Get notice by ID
$r15 = Call3 GET "/notices/$noticeId" $null $adminToken
Test-Case "[T15] Get notice by ID" $r15 $true "fetched"

# [T16] Admin updates notice
$r16 = Call3 PATCH "/notices/$noticeId" @{ title = "Updated Notice Title" } $adminToken
Test-Case "[T16] Admin updates notice" $r16 $true "updated"

# [T17] Delete notice
$r17 = Call3 DELETE "/notices/$noticeId" $null $adminToken
Test-Case "[T17] Delete notice" $r17 $true "deleted"

# [T18] Get deleted notice → NOT_FOUND
$r18 = Call3 GET "/notices/$noticeId" $null $adminToken
Test-Case "[T18] Deleted notice → NOT_FOUND" $r18 $false "NOT_FOUND"

# ══ ASSIGNMENT TESTS ══════════════════════════════════════════════════════════
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

# [T19] Admin creates assignment (deadline: tomorrow)
$r19 = Call3 POST "/assignments" @{ title = "Math Homework"; description = "Solve exercises 1-10"; classIds = @($p3ClassId); deadline = $tomorrow } $adminToken
Test-Case "[T19] Admin creates assignment" $r19 $true "created"
if ($r19.success) { $assignmentId = $r19.data._id }

# [T20] Create assignment with past deadline → VALIDATION_ERROR
$r20 = Call3 POST "/assignments" @{ title = "Past Assignment"; description = "Too late"; deadline = $yesterday } $adminToken
Test-Case "[T20] Past deadline → VALIDATION_ERROR" $r20 $false "VALIDATION_ERROR"

# [T21] Teacher creates assignment for their class
$r21 = Call3 POST "/assignments" @{ title = "Science Lab"; description = "Complete lab report"; classIds = @($p3ClassId); deadline = $tomorrow } $teacherToken
Test-Case "[T21] Teacher creates assignment" $r21 $true "created"

# [T22] Student cannot create assignment
$r22 = Call3 POST "/assignments" @{ title = "Student Assignment"; description = "No."; deadline = $tomorrow } $studentToken
Test-Case "[T22] Student cannot create assignment" $r22 $false "UNAUTHORIZED"

# [T23] List assignments
$r23 = Call3 GET "/assignments" $null $adminToken
Test-Case "[T23] List assignments" $r23 $true "fetched"

# [T24] List upcoming assignments
$r24 = Call3 GET "/assignments?filter=upcoming" $null $adminToken
Test-Case "[T24] List upcoming assignments" $r24 $true "fetched"

# [T25] Get assignment by ID
$r25 = Call3 GET "/assignments/$assignmentId" $null $adminToken
Test-Case "[T25] Get assignment by ID" $r25 $true "fetched"

# [T26] Update assignment
$r26 = Call3 PATCH "/assignments/$assignmentId" @{ title = "Updated Math Homework" } $adminToken
Test-Case "[T26] Update assignment" $r26 $true "updated"

# [T27] Delete assignment
$r27 = Call3 DELETE "/assignments/$assignmentId" $null $adminToken
Test-Case "[T27] Delete assignment" $r27 $true "deleted"

# ══ TIMETABLE TESTS ═══════════════════════════════════════════════════════════
$schedule = @(
  @{ day = "Monday"; periods = @( @{ startTime = "08:00"; endTime = "09:00"; subject = "Math"; teacherName = "Mr. Test"; room = "101" } ) },
  @{ day = "Tuesday"; periods = @( @{ startTime = "09:00"; endTime = "10:00"; subject = "Science"; teacherName = "Mr. Test"; room = "102" } ) }
)

# [T28] Teacher creates timetable
$r28 = Call3 POST "/timetables" @{ classId = $p3ClassId; schedule = $schedule } $teacherToken
Test-Case "[T28] Teacher creates timetable" $r28 $true "created"
if ($r28.success) { $timetableId = $r28.data._id }

# [T29] Duplicate timetable → DUPLICATE_ENTRY
$r29 = Call3 POST "/timetables" @{ classId = $p3ClassId; schedule = $schedule } $teacherToken
Test-Case "[T29] Duplicate timetable → DUPLICATE_ENTRY" $r29 $false "DUPLICATE_ENTRY"

# [T30] Get class timetable
$r30 = Call3 GET "/timetables/class/$p3ClassId" $null $adminToken
Test-Case "[T30] Get class timetable" $r30 $true "fetched"

# [T31] Update timetable
$updatedSchedule = @(
  @{ day = "Monday"; periods = @( @{ startTime = "08:00"; endTime = "09:00"; subject = "English"; teacherName = "Ms. Test"; room = "201" } ) }
)
$r31 = Call3 PATCH "/timetables/$timetableId" @{ schedule = $updatedSchedule } $teacherToken
Test-Case "[T31] Update timetable" $r31 $true "updated"

# [T32] Student cannot delete timetable → UNAUTHORIZED
$r32 = Call3 DELETE "/timetables/$timetableId" $null $studentToken
Test-Case "[T32] Student cannot delete timetable" $r32 $false "UNAUTHORIZED"

# [T33] Admin deletes timetable
$r33 = Call3 DELETE "/timetables/$timetableId" $null $adminToken
Test-Case "[T33] Admin deletes timetable" $r33 $true "deleted"

# ══ REPORT CARD TESTS ═════════════════════════════════════════════════════════
$marks = @( @{ subject = "Math"; marksObtained = 85; totalMarks = 100; grade = "A" } )

# [T34] Admin creates report card
$r34 = Call3 POST "/report-cards" @{ studentId = $studentUserId; classId = $p3ClassId; term = "Term 1"; academicYear = "2025-26"; marks = $marks; remarks = "Good performance" } $adminToken
Test-Case "[T34] Admin creates report card" $r34 $true "created"
if ($r34.success) { $reportCardId = $r34.data._id }

# [T35] Duplicate report card → DUPLICATE_ENTRY
$r35 = Call3 POST "/report-cards" @{ studentId = $studentUserId; classId = $p3ClassId; term = "Term 1"; academicYear = "2025-26"; marks = $marks } $adminToken
Test-Case "[T35] Duplicate report card → DUPLICATE_ENTRY" $r35 $false "DUPLICATE_ENTRY"

# [T36] List student report cards
$r36 = Call3 GET "/report-cards/student/$studentUserId" $null $adminToken
Test-Case "[T36] List student report cards" $r36 $true "fetched"

# [T37] Student can view own report cards
$r37 = Call3 GET "/report-cards/student/$studentUserId" $null $studentToken
Test-Case "[T37] Student views own report cards" $r37 $true "fetched"

# [T38] Update report card
$r38 = Call3 PATCH "/report-cards/$reportCardId" @{ remarks = "Excellent performance" } $adminToken
Test-Case "[T38] Update report card" $r38 $true "updated"

# [T39] Delete report card
$r39 = Call3 DELETE "/report-cards/$reportCardId" $null $adminToken
Test-Case "[T39] Delete report card" $r39 $true "deleted"

# ══ RESULT TESTS ══════════════════════════════════════════════════════════════
$subjectMarks = @( @{ subject = "Math"; marksObtained = 90; totalMarks = 100; grade = "A+" } )

# [T40] Admin creates result
$r40 = Call3 POST "/results" @{ studentId = $studentUserId; classId = $p3ClassId; examName = "Final Exam"; academicYear = "2025-26"; subjectMarks = $subjectMarks; overallGrade = "A+"; rank = 1 } $adminToken
Test-Case "[T40] Admin creates result" $r40 $true "created"
if ($r40.success) { $resultId = $r40.data._id }

# [T41] List student results
$r41 = Call3 GET "/results/student/$studentUserId" $null $adminToken
Test-Case "[T41] List student results" $r41 $true "fetched"

# [T42] Student views own results
$r42 = Call3 GET "/results/student/$studentUserId" $null $studentToken
Test-Case "[T42] Student views own results" $r42 $true "fetched"

# [T43] Update result
$r43 = Call3 PATCH "/results/$resultId" @{ remarks = "Top performer"; rank = 1 } $adminToken
Test-Case "[T43] Update result" $r43 $true "updated"

# [T44] Delete result
$r44 = Call3 DELETE "/results/$resultId" $null $adminToken
Test-Case "[T44] Delete result" $r44 $true "deleted"

# ══ RBAC EDGE CASES ═══════════════════════════════════════════════════════════

# [T45] No token → TOKEN_INVALID
$freshJar = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$r45 = $null
try { $r45 = Invoke-RestMethod -Uri "$baseUrl/notices" -Method GET -WebSession $freshJar -ErrorAction SilentlyContinue }
catch { $raw = $_.ErrorDetails.Message; if ($raw) { $r45 = $raw | ConvertFrom-Json } }
Test-Case "[T45] No token → TOKEN_INVALID" $r45 $false "TOKEN_INVALID"

# ══ RESULTS ═══════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "========== PHASE 3 VALIDATION RESULTS ==========" -ForegroundColor Cyan
$passed = 0; $failed = 0
foreach ($r in $results) {
  if ($r.Pass) {
    Write-Host "  PASS  $($r.Label)  →  $($r.Got.Split('|')[0].Trim())" -ForegroundColor Green
    $passed++
  } else {
    Write-Host "  FAIL  $($r.Label)  →  $($r.Got)" -ForegroundColor Red
    $failed++
  }
}
$total = $passed + $failed
Write-Host ""
if ($failed -eq 0) {
  Write-Host "  $passed/$total passed" -ForegroundColor Green
} else {
  Write-Host "  $passed/$total passed  |  $failed FAILED" -ForegroundColor Yellow
}
