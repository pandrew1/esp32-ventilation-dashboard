# Update Dashboard Build Number
# This script updates the build number in dashboard.html before deployment

$buildHash = git rev-parse --short HEAD
$buildDate = Get-Date -Format "yyyy.MM.dd-HHmm"
$buildNumber = "$buildDate-$buildHash"

Write-Host "Updating build number to: $buildNumber"

# Update the build number in dashboard.html
$dashboardFile = "dashboard.html"
$content = Get-Content $dashboardFile -Raw

# Replace the build info using regex
$updatedContent = $content -replace 'Build: <span id="buildInfo">.*?</span>', "Build: <span id=`"buildInfo`">$buildNumber</span>"

# Write back to file
Set-Content $dashboardFile $updatedContent -NoNewline

Write-Host "Build number updated successfully in $dashboardFile"
Write-Host "New build: $buildNumber"
