# Encode com carga baixa (a máquina já desligou num encode pesado): prioridade abaixo do normal, 1 thread de filtro,
# 2 do x264, e saída num arquivo temporário que só depois vira o definitivo.
# Os quadros (_sub/f_00000.jpg ...) já vêm com desfoque de movimento e foco de dentro do render: 60 qps direto.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$a = '-v error -y -framerate 60 -i _sub/f_%05d.jpg -i audio_final.wav -filter_threads 1 ' +
     '-vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p ' +
     '-map 0:v -map 1:a -c:v libx264 -preset medium -crf 17 -threads 2 ' +
     '-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709 -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 ' +
     '-c:a aac -b:a 192k -movflags +faststart -shortest _tmp.mp4'
$p = Start-Process -FilePath 'ffmpeg' -ArgumentList $a -NoNewWindow -PassThru
$null = $p.Handle
$p.PriorityClass = 'BelowNormal'
$p.WaitForExit()
if ($p.ExitCode -ne 0) { throw "ffmpeg saiu com $($p.ExitCode)" }
Move-Item -Force _tmp.mp4 instagram\motion-tonho-ep03.mp4
Write-Output 'pronto: instagram\motion-tonho-ep03.mp4'
