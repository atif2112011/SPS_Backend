$baseUrl = "http://localhost:5000/api/v1"
$tempDir = Join-Path $env:TEMP "sps-phase4-tests"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$env:NODE_PATH = Join-Path (Get-Location) "node_modules"
$results = [System.Collections.Generic.List[object]]::new()
$adminToken = $null; $studentToken = $null
$studentUserId = $null; $p4ClassId = $null
$noticeId = $null; $assignmentId = $null; $timetableId = $null
$reportCardId = $null; $resultId = $null; $dueAssignmentId = $null

Write-Host "Cleaning up Phase 4 test data..." -ForegroundColor DarkGray
$cleanupScript = @"
require('dotenv').config();
const mongoose = require('mongoose');
async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Notification = require('./src/models/Notification.model');
  const DeviceToken = require('./src/models/DeviceToken.model');
  const Notice = require('./src/models/Notice.model');
  const Assignment = require('./src/models/Assignment.model');
  const Timetable = require('./src/models/Timetable.model');
  const ReportCard = require('./src/models/ReportCard.model');
  const Result = require('./src/models/Result.model');
  const Class = require('./src/models/Class.model');
  await Notification.deleteMany({});
  await DeviceToken.deleteMany({});
  await Notice.deleteMany({ title: { `$regex: /^P4 / } });
  await Assignment.deleteMany({ title: { `$regex: /^P4 / } });
  await Timetable.deleteMany({});
  await ReportCard.deleteMany({ term: { `$regex: /^P4 / } });
  await Result.deleteMany({ examName: { `$regex: /^P4 / } });
  await Class.deleteMany({ className: '10-P4' });
  console.log('Phase 4 cleanup done');
  await mongoose.disconnect();
}
cleanup().catch(e => { console.error(e.message); process.exit(1); });
"@
$cleanupPath = Join-Path $tempDir "cleanup-p4.js"
($cleanupScript -replace "require\('\./src/", "require(process.cwd() + '/src/") | Set-Content -Path $cleanupPath -Encoding utf8
node $cleanupPath
Remove-Item $cleanupPath -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

function Call4 {
  param($Method, $Path, $Body, $Token)
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $params = @{
    Uri = "$baseUrl$Path"
    Method = $Method
    Headers = $headers
    ContentType = "application/json"
    ErrorAction = "SilentlyContinue"
  }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }
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
    Pass = $pass
    Got = "$($response.message) | $($response.errorCode)"
  })
}

function DbScalar {
  param($ScriptBody)
  $path = Join-Path $tempDir "phase4-db-check.js"
  ($ScriptBody -replace "require\('\./src/", "require(process.cwd() + '/src/") | Set-Content -Path $path -Encoding utf8
  $value = node $path
  Remove-Item $path -Force -ErrorAction SilentlyContinue
  $clean = $value | Where-Object {
    $_ -and
    $_ -notlike "◇ injected env*" -and
    $_ -notlike "(node:*" -and
    $_ -notlike "*Warning:*"
  }
  return ($clean | Select-Object -Last 1)
}

function Wait-ForNotifications {
  param($EntityId, $Type, $ExpectedCount = 1)
  for ($i = 0; $i -lt 10; $i++) {
    $count = DbScalar @"
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Notification = require('./src/models/Notification.model');
  const count = await Notification.countDocuments({ entityId: '$EntityId', type: '$Type' });
  console.log(count);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
"@
    if ([int]$count -ge $ExpectedCount) { return [int]$count }
    Start-Sleep -Milliseconds 400
  }
  return 0
}

Write-Host ""
Write-Host "Running Phase 4 tests..." -ForegroundColor Cyan

$loginR = Call4 POST "/auth/login" @{ username = "admin_test"; password = "Test@1234" } $null
Test-Case "[T01] Admin login" $loginR $true "Login"
$adminToken = $loginR.data.accessToken

$studentLoginR = Call4 POST "/auth/login" @{ username = "student_test"; password = "Test@1234" } $null
Test-Case "[T02] Student login" $studentLoginR $true "Login"
$studentToken = $studentLoginR.data.accessToken

$studentsR = Call4 GET "/students?search=student_test" $null $adminToken
$studentUserId = ($studentsR.data | Where-Object { $_.username -eq "student_test" } | Select-Object -First 1)._id
Test-Case "[T03] Student userId resolved" ([PSCustomObject]@{ success = ($null -ne $studentUserId); message = "userId: $studentUserId" }) $true

$classR = Call4 POST "/classes" @{ className = "10-P4"; section = "A"; academicYear = "2025-26" } $adminToken
if ($classR.success) { $p4ClassId = $classR.data._id }
Test-Case "[T04] Phase 4 class created" $classR $true "created"

$setupScript = @"
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const StudentProfile = require('./src/models/StudentProfile.model');
  const Class = require('./src/models/Class.model');
  const classId = '$p4ClassId';
  const studentId = '$studentUserId';
  await StudentProfile.findOneAndUpdate(
    { userId: studentId },
    { admissionNo: 'P4-ADM-001', rollNo: 'P4-01', classId, section: 'A', gender: 'male' },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  await Class.findByIdAndUpdate(classId, { `$addToSet: { studentIds: studentId } });
  console.log('ready');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
"@
$setupValue = DbScalar $setupScript
Test-Case "[T05] Student profile/class membership ready" ([PSCustomObject]@{ success = ($setupValue -eq "ready"); message = $setupValue }) $true

$r06 = Call4 POST "/notifications/register-device" @{ token = "p4_fake_fcm_token_abcdefghijklmnopqrstuvwxyz"; platform = "android" } $studentToken
Test-Case "[T06] Student registers device token" $r06 $true "registered"

$r07 = Call4 GET "/notifications?isRead=false" $null $studentToken
Test-Case "[T07] Student notification feed starts empty" $r07 $true "fetched"

$r08 = Call4 POST "/notices" @{ title = "P4 Global Notice"; message = "Phase 4 event notice"; audienceType = "all_classes" } $adminToken
Test-Case "[T08] Notice creation succeeds" $r08 $true "created"
$noticeId = $r08.data._id
$noticeCount = Wait-ForNotifications $noticeId "notice" 1
Test-Case "[T09] Notice event creates notification" ([PSCustomObject]@{ success = ($noticeCount -ge 1); message = "count: $noticeCount" }) $true

$r10 = Call4 GET "/notifications?type=notice&isRead=false" $null $studentToken
$firstNoticeNotificationId = ($r10.data | Select-Object -First 1)._id
Test-Case "[T10] Student can list unread notice notification" ([PSCustomObject]@{ success = ($null -ne $firstNoticeNotificationId); message = "notificationId: $firstNoticeNotificationId" }) $true

$r11 = Call4 PATCH "/notifications/$firstNoticeNotificationId/read" $null $studentToken
Test-Case "[T11] Student marks one notification read" $r11 $true "read"

$tomorrow = (Get-Date).AddDays(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$r12 = Call4 POST "/assignments" @{ title = "P4 Class Assignment"; description = "Phase 4 assignment"; classIds = @($p4ClassId); deadline = $tomorrow } $adminToken
Test-Case "[T12] Assignment creation succeeds" $r12 $true "created"
$assignmentId = $r12.data._id
$assignmentCount = Wait-ForNotifications $assignmentId "assignment" 1
Test-Case "[T13] Assignment event creates notification" ([PSCustomObject]@{ success = ($assignmentCount -ge 1); message = "count: $assignmentCount" }) $true

$schedule = @(
  @{ day = "Monday"; periods = @( @{ startTime = "08:00"; endTime = "09:00"; subject = "Math"; teacherName = "P4 Teacher"; room = "101" } ) }
)
$r14 = Call4 POST "/timetables" @{ classId = $p4ClassId; schedule = $schedule } $adminToken
Test-Case "[T14] Timetable creation succeeds" $r14 $true "created"
$timetableId = $r14.data._id
$timetableCount = Wait-ForNotifications $timetableId "timetable" 1
Test-Case "[T15] Timetable event creates notification" ([PSCustomObject]@{ success = ($timetableCount -ge 1); message = "count: $timetableCount" }) $true

$marks = @( @{ subject = "Math"; marksObtained = 88; totalMarks = 100; grade = "A" } )
$r16 = Call4 POST "/report-cards" @{ studentId = $studentUserId; classId = $p4ClassId; term = "P4 Term 1"; academicYear = "2025-26"; marks = $marks; remarks = "Good" } $adminToken
Test-Case "[T16] Report card creation succeeds" $r16 $true "created"
$reportCardId = $r16.data._id
$reportCardCount = Wait-ForNotifications $reportCardId "reportCard" 1
Test-Case "[T17] Report card event creates notification" ([PSCustomObject]@{ success = ($reportCardCount -ge 1); message = "count: $reportCardCount" }) $true

$subjectMarks = @( @{ subject = "Math"; marksObtained = 91; totalMarks = 100; grade = "A+" } )
$r18 = Call4 POST "/results" @{ studentId = $studentUserId; classId = $p4ClassId; examName = "P4 Final"; academicYear = "2025-26"; subjectMarks = $subjectMarks; overallGrade = "A+"; rank = 1 } $adminToken
Test-Case "[T18] Result creation succeeds" $r18 $true "created"
$resultId = $r18.data._id
$resultCount = Wait-ForNotifications $resultId "result" 1
Test-Case "[T19] Result event creates notification" ([PSCustomObject]@{ success = ($resultCount -ge 1); message = "count: $resultCount" }) $true

$dueSoon = (Get-Date).AddMinutes(30).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$r20 = Call4 POST "/assignments" @{ title = "P4 Due Soon Assignment"; description = "Reminder dedupe target"; classIds = @($p4ClassId); deadline = $dueSoon } $adminToken
Test-Case "[T20] Due-soon assignment creation succeeds" $r20 $true "created"
if ($r20.success) {
  $dueAssignmentId = $r20.data._id
  $jobScript = @"
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const { runHourlyAssignmentDueReminders } = require('./src/jobs/assignmentReminder.job');
  await runHourlyAssignmentDueReminders();
  await runHourlyAssignmentDueReminders();
  const Notification = require('./src/models/Notification.model');
  const count = await Notification.countDocuments({ entityId: '$dueAssignmentId', type: 'reminder' });
  console.log(count);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
"@
  $reminderCount = DbScalar $jobScript
  Test-Case "[T21] Hourly reminder dedupes repeated runs" ([PSCustomObject]@{ success = ([int]$reminderCount -eq 1); message = "count: $reminderCount" }) $true
} else {
  Test-Case "[T21] Hourly reminder dedupes repeated runs" ([PSCustomObject]@{ success = $false; message = "skipped because due-soon assignment was not created" }) $true
}

$r22 = Call4 PATCH "/notifications/read-all" $null $studentToken
Test-Case "[T22] Student marks all notifications read" $r22 $true "read"

$r23 = Call4 PATCH "/notifications/000000000000000000000000/read" $null $studentToken
Test-Case "[T23] Unknown notification read returns NOT_FOUND" $r23 $false "NOT_FOUND"

$badTokenR = Call4 POST "/notifications/register-device" @{ token = "short"; platform = "android" } $studentToken
Test-Case "[T24] Invalid device token validation" $badTokenR $false "VALIDATION_ERROR"

Write-Host ""
Write-Host "========== PHASE 4 VALIDATION RESULTS ==========" -ForegroundColor Cyan
$passed = 0; $failed = 0
foreach ($r in $results) {
  if ($r.Pass) {
    Write-Host "  PASS  $($r.Label)  ->  $($r.Got.Split('|')[0].Trim())" -ForegroundColor Green
    $passed++
  } else {
    Write-Host "  FAIL  $($r.Label)  ->  $($r.Got)" -ForegroundColor Red
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
