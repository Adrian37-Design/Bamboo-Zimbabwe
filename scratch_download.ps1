$client = New-Object System.Net.WebClient
$client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
$client.Headers.Add("Referer", "https://www.pexels.com/")

# Target UHD 4K video from Pexels (ID: 855018)
$url = "https://videos.pexels.com/video-files/855018/855018-hd_1920_1080_30fps.mp4"
$dest = Join-Path $PSScriptRoot "bamboo.mp4"

Write-Host "Downloading $url to $dest..."
try {
    $client.DownloadFile($url, $dest)
    Write-Host "Success!"
} catch {
    Write-Host "Failed to download HD video: $_"
    
    # Try the alternate Mixkit video link
    $altUrl = "https://assets.mixkit.co/videos/preview/mixkit-wind-blowing-the-leaves-of-a-bamboo-forest-41983-large.mp4"
    Write-Host "Trying alternate URL: $altUrl"
    try {
        $client.DownloadFile($altUrl, $dest)
        Write-Host "Alternate Success!"
    } catch {
        Write-Host "Failed alternate download: $_"
    }
}
