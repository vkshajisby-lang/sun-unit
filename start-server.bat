@echo off
title St. George Sunday School, Karyambadi - Exam Server
color 1F
echo ======================================================================
echo    സെന്റ് ജോർജ് സൺഡേ സ്കൂൾ, കാര്യമ്പാടി - യൂണിറ്റ് പരീക്ഷ സെർവർ
echo       St. George Sunday School, Karyambadi - Unit Test Server
echo ======================================================================
echo.
echo Database: Permanent local database initialized in .\data\db.json
echo Cloud/Network Server starting at port 3000...
echo.
echo Computer Access: http://localhost:3000
echo Mobile Phone Access (Wi-Fi): http://192.168.1.72:3000
echo.
echo ======================================================================
node server.js
pause
