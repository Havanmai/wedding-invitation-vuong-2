@echo off
cd /d "%~dp0"
echo Dang khoi dong server cho vuong.html...
echo Khong dong cua so nay khi dang xem trang.
echo ---------------------------------------------------------------------------
start "" "http://127.0.0.1:8123/vuong.html"
python serve.py
