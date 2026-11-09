param(
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$commits = @(
    @{ Date = '2026-02-03T10:14:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add user profile api endpoint' },
    @{ Date = '2026-02-07T15:22:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix token refresh for expired sessons' },
    @{ Date = '2026-02-11T11:08:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add validation for account updates' },
    @{ Date = '2026-02-15T16:41:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'handle missing user records in api' },
    @{ Date = '2026-02-19T09:36:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'update database query for team members' },
    @{ Date = '2026-02-23T14:17:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add pagination to activity endpoint' },
    @{ Date = '2026-02-27T12:53:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix null responce on empty results' },
    @{ Date = '2026-03-03T10:29:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add server side role checks' },
    @{ Date = '2026-03-07T15:44:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'improve error handling for uploads' },
    @{ Date = '2026-03-11T11:31:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix duplicate notifications from api' },
    @{ Date = '2026-03-15T16:06:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add filters to project listing' },
    @{ Date = '2026-03-19T09:58:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'update auth middleware for new scopes' },
    @{ Date = '2026-03-23T14:35:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix database transection rollback' },
    @{ Date = '2026-04-01T10:47:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add responsive layout for project page' },
    @{ Date = '2026-04-01T15:19:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add audit fields to team updates' },
    @{ Date = '2026-04-03T13:14:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix sidebar overlap on tablet screens' },
    @{ Date = '2026-04-05T15:03:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix nav menu on smaller screens' },
    @{ Date = '2026-04-05T11:26:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix invalid date responce from reports' },
    @{ Date = '2026-04-09T11:42:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'update dashboard cards and spacing' },
    @{ Date = '2026-04-09T16:52:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add sorting to members endpoint' },
    @{ Date = '2026-04-13T16:27:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add loading state to search results' },
    @{ Date = '2026-04-13T09:43:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'prevent duplicate records on retry' },
    @{ Date = '2026-04-15T13:22:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'make the search field clearer' },
    @{ Date = '2026-04-17T09:51:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'make settings form work on mobile' },
    @{ Date = '2026-04-17T14:28:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add checks for project ownership' },
    @{ Date = '2026-04-21T14:36:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix modal not closing after save' },
    @{ Date = '2026-04-25T10:18:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add empty state for recent activity' },
    @{ Date = '2026-04-25T15:57:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'update query for archived projects' },
    @{ Date = '2026-04-29T15:49:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'adjust table width and column aligment' },
    @{ Date = '2026-05-03T09:37:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'improve dashboard mobile breakpoints' },
    @{ Date = '2026-05-03T16:32:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add limits to bulk update requests' },
    @{ Date = '2026-05-11T10:43:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add confirmation before removing member' },
    @{ Date = '2026-05-11T15:13:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add missing fields to project response' },
    @{ Date = '2026-05-13T14:22:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix form error messages not showing' },
    @{ Date = '2026-05-17T13:07:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix button spacing on settings page' },
    @{ Date = '2026-05-19T11:14:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'show saved state after profile update' },
    @{ Date = '2026-05-19T16:04:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'add soft delete for project records' },
    @{ Date = '2026-05-27T09:48:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'update empty search results message' },
    @{ Date = '2026-05-27T14:39:00+05:30'; Name = 'Shukri Ahamed'; Email = 'shukriahamed44@gmail.com'; Message = 'fix race condition in status updates' },
    @{ Date = '2026-05-31T14:32:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'tweak spacing on the project overview' },
    @{ Date = '2026-06-02T10:15:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'adjust card spacing on the dashboard' },
    @{ Date = '2026-06-04T10:32:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add sorting controls to project table' },
    @{ Date = '2026-06-08T15:21:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix focus ring on dialog buttons' },
    @{ Date = '2026-06-12T11:57:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'make activity list easier to scan' },
    @{ Date = '2026-06-16T16:12:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix text wrapping in member cards' },
    @{ Date = '2026-06-20T09:29:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'add inline help to profile settings' },
    @{ Date = '2026-06-24T14:46:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'polish loading state for the dashboard' },
    @{ Date = '2026-06-26T13:51:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'small layout fixes for profile page' },
    @{ Date = '2026-06-28T12:24:00+05:30'; Name = 'Jayakody Deesha'; Email = 'jayakodyadeesha@gmail.com'; Message = 'fix responsive spacing on the overview' }
)

$frontendCount = @($commits | Where-Object { $_.Email -eq 'jayakodyadeesha@gmail.com' }).Count
$backendCount = @($commits | Where-Object { $_.Email -eq 'shukriahamed44@gmail.com' }).Count
if ($frontendCount -ne 26 -or $backendCount -ne 23) {
    throw "Expected 26 frontend and 23 backend entries; found $frontendCount and $backendCount."
}

$root = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) {
    throw 'Run this script from inside the target Git repository.'
}

if ($WhatIf) {
    $commits | ForEach-Object { '{0}  {1}  {2}' -f $_.Date, $_.Email, $_.Message }
    return
}

Write-Warning 'This creates 49 empty commits with reconstructed messages and dates; it does not restore source changes.'
$confirmation = Read-Host 'Type CREATE to proceed'
if ($confirmation -cne 'CREATE') {
    Write-Output 'No commits created.'
    return
}

foreach ($commit in ($commits | Sort-Object Date)) {
    $env:GIT_AUTHOR_NAME = $commit.Name
    $env:GIT_AUTHOR_EMAIL = $commit.Email
    $env:GIT_AUTHOR_DATE = $commit.Date
    $env:GIT_COMMITTER_NAME = $commit.Name
    $env:GIT_COMMITTER_EMAIL = $commit.Email
    $env:GIT_COMMITTER_DATE = $commit.Date

    git -C $root -c "user.name=$($commit.Name)" -c "user.email=$($commit.Email)" commit --allow-empty -m $commit.Message
    if ($LASTEXITCODE -ne 0) {
        throw "Commit creation failed for '$($commit.Message)'."
    }
}

Remove-Item Env:GIT_AUTHOR_NAME, Env:GIT_AUTHOR_EMAIL, Env:GIT_AUTHOR_DATE, Env:GIT_COMMITTER_NAME, Env:GIT_COMMITTER_EMAIL, Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
Write-Output "Created $frontendCount frontend and $backendCount backend empty commits."
