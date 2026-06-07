$baseUrl = "http://localhost:5000/api/v1"
$jar = New-Object Microsoft.PowerShell.Commands.WebRequestSession  # fresh session, no cookies
$results = [System.Collections.Generic.List[object]]::new()
$adminToken = $null; $teacherToken = $null; $studentToken = $null
$studentId = $null; $teacherId = $null; $classId = $null

# ── Cleanup leftover test data from previous runs ────────────────────────────
Write-Host "Cleaning up previous test data..." -ForegroundColor DarkGray
$cleanupScript = @"
require('dotenv').config();
const mongoose = require('mongoose');
async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('./src/models/User.model');
  const StudentProfile = require('./src/models/StudentProfile.model');
  const TeacherProfile = require('./src/models/TeacherProfile.model');
  const Class = require('./src/models/Class.model');
  const users = await User.find({ username: { `$in: ['student_p2','student_p2b','teacher_p2','teacher_p2b'] } });
  const ids = users.map(u => u._id);
  await StudentProfile.deleteMany({ userId: { `$in: ids } });
  await StudentProfile.deleteMany({ admissionNo: { `$in: ['ADM-101','ADM-102'] } });
  await TeacherProfile.deleteMany({ userId: { `$in: ids } });
  await TeacherProfile.deleteMany({ employeeId: { `$in: ['EMP-101'] } });
  await User.deleteMany({ username: { `$in: ['student_p2','student_p2b','teacher_p2','teacher_p2b'] } });
  await Class.deleteMany({ className: 'Class 10', academicYear: '2025-26' });
  await mongoose.disconnect();
}
cleanup().catch(e => { console.error(e.message); process.exit(1); });
"@
$cleanupScript | Set-Content -Path "$PSScriptRoot\cleanup-test.js" -Encoding utf8
node "$PSScriptRoot\cleanup-test.js"
Remove-Item "$PSScriptRoot\cleanup-test.js" -Force -ErrorAction SilentlyContinue
Write-Host "Cleanup complete. Waiting for server..." -ForegroundColor DarkGray
Start-Sleep -Seconds 2

function Call($method, $path, $body = $null, $token = $null) {
    $params = @{ Uri="$using:baseUrl$path"; Method=$method; ContentType="application/json"; WebSession=$using:jar }
    if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 5 -Compress) }
    if ($token) { $params.Headers = @{ Authorization="Bearer $token" } }
    try   { return Invoke-RestMethod @params }
    catch { $raw = $_.ErrorDetails.Message; if ($raw) { return ($raw | ConvertFrom-Json) } else { return [pscustomobject]@{success=$false;error=$_.Exception.Message} } }
}
function Call2($method, $path, $body = $null, $token = $null) {
    $params = @{ Uri="$baseUrl$path"; Method=$method; ContentType="application/json"; WebSession=$jar }
    if ($body)  { $params.Body = ($body | ConvertTo-Json -Depth 5 -Compress) }
    if ($token) { $params.Headers = @{ Authorization="Bearer $token" } }
    try   { return Invoke-RestMethod @params }
    catch { $raw = $_.ErrorDetails.Message; if ($raw) { return ($raw | ConvertFrom-Json) } else { return [pscustomobject]@{success=$false;error=$_.Exception.Message} } }
}

function Test-Case($name, $r, $expectPass, $expectCode = $null, $expectField = $null, $expectVal = $null) {
    $pass = $false
    if ($expectPass) {
        $pass = ($r.success -eq $true)
    } elseif ($expectCode) {
        $pass = ($r.errorCode -eq $expectCode)
    }
    if ($expectField -and $expectVal) {
        $actual = $r
        foreach ($seg in $expectField.Split('.')) { $actual = $actual.$seg }
        $pass = ($actual -eq $expectVal)
    }
    $got = if ($r.errorCode) { $r.errorCode } elseif ($r.message) { $r.message } else { "success=$($r.success)" }
    $results.Add([pscustomobject]@{ Name=$name; Pass=$pass; Got=$got })
}

# ── Login ────────────────────────────────────────────────────────────────────
$r = Call2 POST "/auth/login" @{ username="admin_test"; password="Test@1234" }
$adminToken = $r.data.accessToken
Test-Case "[01] Admin login for token" $r $true

# ── Student creation ─────────────────────────────────────────────────────────
$r = Call2 POST "/users/students" @{ username="s1" } -token $adminToken
Test-Case "[02] Create student missing fields" $r $false "VALIDATION_ERROR"

$r = Call2 POST "/users/students" @{
    username="student_p2"; password="Pass@1234"; name="Phase2 Student"
    admissionNo="ADM-101"; rollNo="01"; section="A"; gender="male"
    guardianName="Parent"; guardianPhone="9876543210"
} -token $adminToken
Test-Case "[03] Create student happy path" $r $true
$studentId = $r.data.user._id

$r = Call2 POST "/users/students" @{ username="student_p2b"; password="Pass@1234"; name="Dup Student"; admissionNo="ADM-101" } -token $adminToken
Test-Case "[04] Create student dup admissionNo" $r $false "DUPLICATE_ENTRY"

$r = Call2 POST "/users/students" @{ username="student_p2"; password="Pass@1234"; name="Dup Student"; admissionNo="ADM-102" } -token $adminToken
Test-Case "[05] Create student dup username" $r $false "DUPLICATE_ENTRY"

# ── Teacher creation ──────────────────────────────────────────────────────────
$r = Call2 POST "/users/teachers" @{
    username="teacher_p2"; password="Pass@1234"; name="Phase2 Teacher"
    employeeId="EMP-101"; subjects=@("Math","Science"); qualification="B.Ed"
} -token $adminToken
Test-Case "[06] Create teacher happy path" $r $true
$teacherId = $r.data.user._id

$r = Call2 POST "/users/teachers" @{ username="teacher_p2b"; password="Pass@1234"; name="Dup Teacher"; employeeId="EMP-101" } -token $adminToken
Test-Case "[07] Create teacher dup employeeId" $r $false "DUPLICATE_ENTRY"

# ── List ──────────────────────────────────────────────────────────────────────
$r = Call2 GET "/students?page=1&limit=10" -token $adminToken
Test-Case "[08] List students paginated" $r $true

$r = Call2 GET "/students?search=Phase2" -token $adminToken
$searchCount = if ($r.data) { $r.data.Count } else { 0 }
Test-Case "[09] List students search" $r ($searchCount -ge 1 -or $r.success) $true

$r = Call2 GET "/teachers?page=1&limit=10" -token $adminToken
Test-Case "[10] List teachers paginated" $r $true

# ── Get / Update ──────────────────────────────────────────────────────────────
$r = Call2 GET "/students/$studentId" -token $adminToken
Test-Case "[11] Get student by ID" $r $true

$r = Call2 GET "/students/000000000000000000000000" -token $adminToken
Test-Case "[12] Get student not found" $r $false "NOT_FOUND"

$r = Call2 PATCH "/students/$studentId" @{ name="Updated Student Name"; address="123 Street" } -token $adminToken
Test-Case "[13] Update student" $r $true

# ── Block / Unblock ──────────────────────────────────────────────────────────
$r = Call2 POST "/students/$studentId/block" -token $adminToken
Test-Case "[14] Block student" $r $true

$r = Call2 POST "/students/$studentId/unblock" -token $adminToken
Test-Case "[15] Unblock student" $r $true

# ── Class ─────────────────────────────────────────────────────────────────────
$r = Call2 POST "/classes" @{ className="Class 10" } -token $adminToken
Test-Case "[16] Create class missing fields" $r $false "VALIDATION_ERROR"

$r = Call2 POST "/classes" @{ className="Class 10"; section="A"; academicYear="2025-26" } -token $adminToken
Test-Case "[17] Create class happy path" $r $true
$classId = $r.data._id

$r = Call2 POST "/classes" @{ className="Class 10"; section="A"; academicYear="2025-26" } -token $adminToken
Test-Case "[18] Create class duplicate" $r $false "DUPLICATE_ENTRY"

$r = Call2 GET "/classes?page=1&limit=10" -token $adminToken
Test-Case "[19] List classes" $r $true

$r = Call2 GET "/classes/$classId" -token $adminToken
Test-Case "[20] Get class by ID" $r $true

$r = Call2 PATCH "/classes/$classId" @{ section="B" } -token $adminToken
Test-Case "[21] Update class" $r $true

$r = Call2 PATCH "/classes/$classId/teacher" @{ teacherId=$teacherId } -token $adminToken
Test-Case "[22] Assign teacher to class" $r $true

$r = Call2 PATCH "/classes/$classId/members" @{ action="add"; studentIds=@($studentId) } -token $adminToken
Test-Case "[23] Add student to class" $r $true

$r = Call2 GET "/classes/$classId/students" -token $adminToken
$classStudentCount = if ($r.data) { $r.data.Count } else { 0 }
Test-Case "[24] Get class students" $r ($classStudentCount -ge 1 -or $r.success) $true

$r = Call2 PATCH "/classes/$classId/members" @{ action="remove"; studentIds=@($studentId) } -token $adminToken
Test-Case "[25] Remove student from class" $r $true

# ── RBAC checks ───────────────────────────────────────────────────────────────
$r = Call2 POST "/auth/login" @{ username="teacher_test"; password="Test@1234" }
$teacherToken = $r.data.accessToken
$r = Call2 POST "/classes" @{ className="X"; section="A"; academicYear="2025" } -token $teacherToken
Test-Case "[26] Teacher cannot create class" $r $false "UNAUTHORIZED"

$r = Call2 POST "/auth/login" @{ username="student_test"; password="Test@1234" }
$studentToken = $r.data.accessToken
$r = Call2 GET "/teachers" -token $studentToken
Test-Case "[27] Student cannot list teachers" $r $false "UNAUTHORIZED"

# [28] Use a completely clean session with NO cookies to test unauthenticated access
$cleanJar = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try { $r = Invoke-RestMethod -Uri "$baseUrl/students" -Method GET -ContentType "application/json" -WebSession $cleanJar } catch { $raw = $_.ErrorDetails.Message; if ($raw) { $r = $raw | ConvertFrom-Json } }
Test-Case "[28] No token 401" $r $false "TOKEN_INVALID"

# ── Soft delete ───────────────────────────────────────────────────────────────
$r = Call2 DELETE "/students/$studentId" -token $adminToken
Test-Case "[29] Soft delete student" $r $true

$r = Call2 GET "/students/$studentId" -token $adminToken
Test-Case "[30] Deleted student not found" $r $false "NOT_FOUND"

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n========== PHASE 2 VALIDATION RESULTS ==========" -ForegroundColor Cyan
$pass=0; $fail=0
foreach ($t in $results) {
    if ($t.Pass) { Write-Host "  PASS  $($t.Name)  →  $($t.Got)" -ForegroundColor Green; $pass++ }
    else         { Write-Host "  FAIL  $($t.Name)  →  $($t.Got)" -ForegroundColor Red; $fail++ }
}
Write-Host "`n  $pass/$($results.Count) passed" -ForegroundColor $(if($fail -eq 0){"Green"}else{"Yellow"})
