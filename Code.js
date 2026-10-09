/**
 * ====================================================================
 * BACKEND GOOGLE APPS SCRIPT: Hafalan Juz 30 & Hadits Arba'in
 * Berkas    : Code.js (Code.gs)
 * Platform  : Google Apps Script (GAS)
 * Database  : Google Spreadsheet (Google Sheets) + PropertiesService
 * Fitur     : Autentikasi Santri, Hash Sandi SHA-256, Database Google Sheets,
 *             Penyimpanan Hafalan Ayat & Hadits, Reset Sandi & Magic Link
 * ====================================================================
 */

// Nama-nama sheet di Google Spreadsheet
var SHEET_USERS = 'Santri_Users';
var SHEET_AYAT = 'Santri_Ayat';
var SHEET_HADITS = 'Santri_Hadits';

/**
 * Mendapatkan atau menginisialisasi Google Spreadsheet sebagai Database
 */
function getDatabaseSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SPREADSHEET_ID');

  var ss = null;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.warn("Gagal membuka spreadsheet via ID tersimpan, mencoba cara lain:", e);
    }
  }

  // Jika script terikat langsung pada Google Sheet
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        props.setProperty('SPREADSHEET_ID', ss.getId());
      }
    } catch (e) {}
  }

  // Jika belum ada spreadsheet yang terhubung, buat otomatis di Google Drive akun ini
  if (!ss) {
    try {
      ss = SpreadsheetApp.create('Database Hafalan Juz 30 & Hadits Arba\'in 🌟');
      props.setProperty('SPREADSHEET_ID', ss.getId());
      console.log("Berhasil membuat Spreadsheet baru: " + ss.getUrl());
    } catch (createErr) {
      console.error("Gagal membuat Spreadsheet otomatis:", createErr);
    }
  }

  if (ss) {
    setupDatabaseTables(ss);
  }

  return ss;
}

/**
 * Menginisialisasi Header tabel dan format visual jika belum ada
 */
function setupDatabaseTables(ss) {
  if (!ss) return;

  // 1. Sheet Users
  var sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEET_USERS);
    sheetUsers.appendRow([
      'User ID',
      'Nama Santri',
      'Email',
      'Avatar',
      'Salt',
      'Password Hash',
      'Kata Sandi Sementara',
      'Auth Provider',
      'Tanggal Daftar',
      'Terakhir Aktif'
    ]);
    formatHeaderRow(sheetUsers, 10);
  }

  // 2. Sheet Hafalan Ayat
  var sheetAyat = ss.getSheetByName(SHEET_AYAT);
  if (!sheetAyat) {
    sheetAyat = ss.insertSheet(SHEET_AYAT);
    sheetAyat.appendRow([
      'User ID',
      'Email',
      'Surah ID',
      'Ayat No',
      'Item Key',
      'Status',
      'Timestamp'
    ]);
    formatHeaderRow(sheetAyat, 7);
  }

  // 3. Sheet Hafalan Hadits
  var sheetHadits = ss.getSheetByName(SHEET_HADITS);
  if (!sheetHadits) {
    sheetHadits = ss.insertSheet(SHEET_HADITS);
    sheetHadits.appendRow([
      'User ID',
      'Email',
      'Hadits ID',
      'Status',
      'Timestamp'
    ]);
    formatHeaderRow(sheetHadits, 5);
  }
}

/**
 * Format baris header agar rapi dengan warna khas zamrud
 */
function formatHeaderRow(sheet, colCount) {
  try {
    var range = sheet.getRange(1, 1, 1, colCount);
    range.setBackground('#059669');
    range.setFontColor('#ffffff');
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
    for (var c = 1; c <= colCount; c++) {
      sheet.autoResizeColumn(c);
    }
  } catch (e) {}
}

/**
 * Hash password dengan SHA-256 + Salt
 */
function hashPassword(password, salt) {
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) hex += '0';
    hex += byteHex;
  }
  return hex;
}

function generateSessionToken(userId) {
  return 'tok_' + userId + '_' + Utilities.getUuid().replace(/-/g, '');
}

/**
 * API: Registrasi Santri Baru ke Google Sheets
 */
function apiRegister(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    var password = data.password || '';
    var name = (data.name || '').trim();
    var avatar = data.avatar || '🦁';
    var authProvider = data.authProvider || 'email';

    if (!email || !password || !name) {
      return { success: false, message: 'Nama, email, dan kata sandi wajib diisi!' };
    }

    var ss = getDatabaseSpreadsheet();
    var userSheet = ss ? ss.getSheetByName(SHEET_USERS) : null;

    // Cek apakah email sudah terdaftar
    if (userSheet) {
      var dataValues = userSheet.getDataRange().getValues();
      for (var i = 1; i < dataValues.length; i++) {
        var existingEmail = (dataValues[i][2] || '').toString().toLowerCase().trim();
        if (existingEmail === email) {
          return { success: false, message: 'Email sudah terdaftar. Silakan langsung masuk.' };
        }
      }
    }

    var salt = Utilities.getUuid().substring(0, 16);
    var passwordHash = hashPassword(password, salt);
    var userId = 'id_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
    var nowIso = new Date().toISOString();

    // Simpan ke Google Sheets
    if (userSheet) {
      userSheet.appendRow([
        userId,
        name,
        email,
        avatar,
        salt,
        passwordHash,
        '', // temp password
        authProvider,
        nowIso,
        nowIso
      ]);
    }

    // Backup ke PropertiesService untuk kecepatan ekstra
    var props = PropertiesService.getScriptProperties();
    props.setProperty('idmap_' + userId, email);

    var token = generateSessionToken(userId);
    props.setProperty('sess_' + token, userId);

    return {
      success: true,
      token: token,
      user: {
        id: userId,
        userId: userId,
        name: name,
        email: email,
        avatar: avatar,
        authProvider: authProvider
      },
      progress: {},
      haditsProgress: {}
    };
  } catch (err) {
    return { success: false, message: 'Gagal mendaftar: ' + err.message };
  }
}

/**
 * API: Login Santri via Google Sheets
 */
function apiLogin(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    var password = data.password || '';

    if (!email || !password) {
      return { success: false, message: 'Email dan kata sandi wajib diisi!' };
    }

    var ss = getDatabaseSpreadsheet();
    var userSheet = ss ? ss.getSheetByName(SHEET_USERS) : null;
    if (!userSheet) {
      return { success: false, message: 'Database belum siap. Silakan coba sesaat lagi.' };
    }

    var dataValues = userSheet.getDataRange().getValues();
    var userRowIdx = -1;
    var userRow = null;

    for (var i = 1; i < dataValues.length; i++) {
      var rowEmail = (dataValues[i][2] || '').toString().toLowerCase().trim();
      if (rowEmail === email) {
        userRowIdx = i + 1; // 1-based row index
        userRow = dataValues[i];
        break;
      }
    }

    if (!userRow) {
      return { success: false, message: 'Akun Anda belum terdaftar di aplikasi. Silakan periksa kembali email Anda atau buat akun baru terlebih dahulu.' };
    }

    var userId = userRow[0];
    var userName = userRow[1];
    var userAvatar = userRow[3];
    var salt = userRow[4];
    var storedHash = userRow[5];
    var tempPassword = userRow[6];

    var testHash = hashPassword(password, salt);
    var isPasswordMatch = (testHash === storedHash);
    var isTempPasswordMatch = (tempPassword && password === tempPassword);

    if (!isPasswordMatch && !isTempPasswordMatch) {
      return { success: false, message: 'Kata sandi tidak sesuai. Silakan periksa kembali.' };
    }

    // Perbarui waktu Terakhir Aktif
    try {
      userSheet.getRange(userRowIdx, 10).setValue(new Date().toISOString());
    } catch (e) {}

    // Ambil progres hafalan ayat dari sheet Santri_Ayat
    var progress = {};
    var ayatSheet = ss.getSheetByName(SHEET_AYAT);
    if (ayatSheet) {
      var ayatData = ayatSheet.getDataRange().getValues();
      for (var a = 1; a < ayatData.length; a++) {
        if (ayatData[a][0] === userId || (ayatData[a][1] || '').toString().toLowerCase().trim() === email) {
          var itemKey = ayatData[a][4];
          progress[itemKey] = {
            status: ayatData[a][5],
            timestamp: ayatData[a][6] || Date.now()
          };
        }
      }
    }

    // Ambil progres hadits dari sheet Santri_Hadits
    var haditsProgress = {};
    var haditsSheet = ss.getSheetByName(SHEET_HADITS);
    if (haditsSheet) {
      var haditsData = haditsSheet.getDataRange().getValues();
      for (var h = 1; h < haditsData.length; h++) {
        if (haditsData[h][0] === userId || (haditsData[h][1] || '').toString().toLowerCase().trim() === email) {
          var haditsId = haditsData[h][2];
          haditsProgress[haditsId] = {
            status: haditsData[h][3],
            timestamp: haditsData[h][4] || Date.now()
          };
        }
      }
    }

    var token = generateSessionToken(userId);
    var props = PropertiesService.getScriptProperties();
    props.setProperty('sess_' + token, userId);
    props.setProperty('idmap_' + userId, email);

    return {
      success: true,
      token: token,
      user: {
        id: userId,
        userId: userId,
        name: userName,
        email: email,
        avatar: userAvatar
      },
      progress: progress,
      haditsProgress: haditsProgress
    };
  } catch (err) {
    return { success: false, message: 'Gagal masuk: ' + err.message };
  }
}

/**
 * API: Cek apakah email terdaftar (Validasi Lupa Kata Sandi)
 */
function apiCheckUser(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    if (!email) return { success: false, exists: false, message: 'Email tidak boleh kosong.' };

    var ss = getDatabaseSpreadsheet();
    var userSheet = ss ? ss.getSheetByName(SHEET_USERS) : null;
    if (!userSheet) return { success: false, exists: false };

    var dataValues = userSheet.getDataRange().getValues();
    for (var i = 1; i < dataValues.length; i++) {
      var rowEmail = (dataValues[i][2] || '').toString().toLowerCase().trim();
      if (rowEmail === email) {
        return {
          success: true,
          exists: true,
          user: {
            id: dataValues[i][0],
            name: dataValues[i][1],
            email: rowEmail,
            avatar: dataValues[i][3]
          }
        };
      }
    }
    return { success: true, exists: false };
  } catch (e) {
    return { success: false, exists: false, message: e.message };
  }
}

/**
 * API: Lupa Kata Sandi (Solusi Nomor 1: Buat Sandi Sementara & Kirim Email)
 */
function apiForgotPassword(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    if (!email) {
      return { success: false, message: 'Alamat email wajib diisi!' };
    }

    var ss = getDatabaseSpreadsheet();
    var userSheet = ss ? ss.getSheetByName(SHEET_USERS) : null;
    if (!userSheet) {
      return { success: false, message: 'Database Google Sheets belum siap.' };
    }

    var dataValues = userSheet.getDataRange().getValues();
    var userRowIdx = -1;
    var userRow = null;

    for (var i = 1; i < dataValues.length; i++) {
      var rowEmail = (dataValues[i][2] || '').toString().toLowerCase().trim();
      if (rowEmail === email) {
        userRowIdx = i + 1;
        userRow = dataValues[i];
        break;
      }
    }

    // Jika akun belum terdaftar
    if (!userRow) {
      return {
        success: false,
        message: 'Akun Anda belum terdaftar di aplikasi. Silakan periksa kembali email Anda atau buat akun baru terlebih dahulu.'
      };
    }

    var userName = userRow[1];

    // 1. Buat Kata Sandi Sementara (Juz30-XXXX)
    var randomCode = Math.floor(1000 + Math.random() * 9000);
    var tempPassword = 'Juz30-' + randomCode;

    // 2. Simpan sandi sementara di kolom 'Kata Sandi Sementara' (kolom 7)
    userSheet.getRange(userRowIdx, 7).setValue(tempPassword);

    // 3. Tautan Masuk Otomatis (Magic Link)
    var appUrl = 'https://hafalan-juz30-two.vercel.app';
    var magicLoginUrl = appUrl + '?quick_login=true&email=' + encodeURIComponent(email) + '&key=' + encodeURIComponent(tempPassword);

    // 4. Kirim notifikasi email via Gmail (opsional background)
    try {
      if (typeof MailApp !== 'undefined') {
        var htmlContent = ''
          + '<div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">'
          + '  <div style="text-align: center; margin-bottom: 20px;">'
          + '    <h1 style="color: #059669; margin: 0; font-size: 22px;">Generasi Cerdas • Metode Ummi 🌟</h1>'
          + '    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Hafalan Al-Qur\'an Juz 30 & Hadits Arba\'in</p>'
          + '  </div>'
          + '  <p style="font-size: 14px; color: #334155;">Assalamu\'alaikum <b>' + (userName || 'Sahabat Cilik') + '</b>,</p>'
          + '  <p style="font-size: 14px; color: #334155; line-height: 1.6;">Kata sandi sementara akun santri Anda telah berhasil dibuat:</p>'
          + '  <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">'
          + '    <span style="font-size: 11px; color: #047857; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 6px;">Kata Sandi Sementara Anda:</span>'
          + '    <span style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #065f46; font-family: monospace;">' + tempPassword + '</span>'
          + '  </div>'
          + '  <div style="text-align: center; margin: 20px 0;">'
          + '    <a href="' + magicLoginUrl + '" style="background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 14px;">Masuk Otomatis ke Aplikasi 🚀</a>'
          + '  </div>'
          + '  <p style="font-size: 12px; color: #64748b;">Anda dapat mengganti kata sandi ini kapan saja di menu profil akun Anda.</p>'
          + '</div>';

        MailApp.sendEmail({
          to: email,
          subject: '🔑 Kata Sandi Baru Akun Hafalan Juz 30: ' + tempPassword,
          htmlBody: htmlContent,
          body: 'Kata sandi sementara akun Anda adalah: ' + tempPassword + '\n\nMasuk otomatis:\n' + magicLoginUrl
        });
      }
    } catch (mailErr) {
      console.warn("MailApp notice:", mailErr);
    }

    return {
      success: true,
      tempPassword: tempPassword,
      magicLoginUrl: magicLoginUrl,
      message: 'Kata sandi sementara berhasil dibuat.'
    };
  } catch (err) {
    return { success: false, message: 'Gagal memproses lupa sandi: ' + err.message };
  }
}

/**
 * API: Simpan Progres Ayat ke Google Sheets
 */
function apiSaveProgress(data) {
  try {
    var userId = data.userId;
    var email = (data.email || '').toLowerCase().trim();
    var surahId = data.surahId;
    var ayahNum = data.ayahNum;
    var status = data.status;
    var timestamp = data.timestamp || Date.now();
    var itemKey = surahId + '_' + ayahNum;

    var ss = getDatabaseSpreadsheet();
    var ayatSheet = ss ? ss.getSheetByName(SHEET_AYAT) : null;
    if (!ayatSheet) return { success: false, message: 'Sheet tidak tersedia.' };

    var dataValues = ayatSheet.getDataRange().getValues();
    var foundRowIdx = -1;

    for (var i = 1; i < dataValues.length; i++) {
      if ((dataValues[i][0] === userId || dataValues[i][1] === email) && dataValues[i][4] === itemKey) {
        foundRowIdx = i + 1;
        break;
      }
    }

    if (foundRowIdx > 0) {
      ayatSheet.getRange(foundRowIdx, 6).setValue(status);
      ayatSheet.getRange(foundRowIdx, 7).setValue(timestamp);
    } else {
      ayatSheet.appendRow([userId, email, surahId, ayahNum, itemKey, status, timestamp]);
    }

    return { success: true, key: itemKey, status: status };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * API: Simpan Progres Borongan Ayat
 */
function apiSaveBulkProgress(data) {
  try {
    var userId = data.userId;
    var email = (data.email || '').toLowerCase().trim();
    var updates = data.updates || [];
    var timestamp = data.timestamp || Date.now();

    var ss = getDatabaseSpreadsheet();
    var ayatSheet = ss ? ss.getSheetByName(SHEET_AYAT) : null;
    if (!ayatSheet) return { success: false };

    var dataValues = ayatSheet.getDataRange().getValues();
    var rowMap = {};
    for (var i = 1; i < dataValues.length; i++) {
      if (dataValues[i][0] === userId || dataValues[i][1] === email) {
        rowMap[dataValues[i][4]] = i + 1;
      }
    }

    for (var u = 0; u < updates.length; u++) {
      var item = updates[u];
      var itemKey = item.surahId + '_' + item.ayahNum;
      if (rowMap[itemKey]) {
        ayatSheet.getRange(rowMap[itemKey], 6).setValue(item.status);
        ayatSheet.getRange(rowMap[itemKey], 7).setValue(timestamp);
      } else {
        ayatSheet.appendRow([userId, email, item.surahId, item.ayahNum, itemKey, item.status, timestamp]);
      }
    }

    return { success: true, count: updates.length };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * API: Simpan Progres Hadits ke Google Sheets
 */
function apiSaveHaditsProgress(data) {
  try {
    var userId = data.userId;
    var email = (data.email || '').toLowerCase().trim();
    var haditsId = data.haditsId;
    var status = data.status;
    var timestamp = data.timestamp || Date.now();

    var ss = getDatabaseSpreadsheet();
    var haditsSheet = ss ? ss.getSheetByName(SHEET_HADITS) : null;
    if (!haditsSheet) return { success: false };

    var dataValues = haditsSheet.getDataRange().getValues();
    var foundRowIdx = -1;

    for (var i = 1; i < dataValues.length; i++) {
      if ((dataValues[i][0] === userId || dataValues[i][1] === email) && dataValues[i][2] == haditsId) {
        foundRowIdx = i + 1;
        break;
      }
    }

    if (foundRowIdx > 0) {
      haditsSheet.getRange(foundRowIdx, 4).setValue(status);
      haditsSheet.getRange(foundRowIdx, 5).setValue(timestamp);
    } else {
      haditsSheet.appendRow([userId, email, haditsId, status, timestamp]);
    }

    return { success: true, haditsId: haditsId, status: status };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * API: Perbarui Profil Santri di Google Sheets
 */
function apiUpdateProfile(data) {
  try {
    var userId = data.userId;
    var email = (data.email || '').toLowerCase().trim();
    var name = (data.name || '').trim();
    var avatar = data.avatar;
    var newPassword = data.password;

    var ss = getDatabaseSpreadsheet();
    var userSheet = ss ? ss.getSheetByName(SHEET_USERS) : null;
    if (!userSheet) return { success: false };

    var dataValues = userSheet.getDataRange().getValues();
    var userRowIdx = -1;

    for (var i = 1; i < dataValues.length; i++) {
      if (dataValues[i][0] === userId || dataValues[i][2] === email) {
        userRowIdx = i + 1;
        break;
      }
    }

    if (userRowIdx > 0) {
      if (name) userSheet.getRange(userRowIdx, 2).setValue(name);
      if (avatar) userSheet.getRange(userRowIdx, 4).setValue(avatar);
      if (newPassword) {
        var salt = Utilities.getUuid().substring(0, 16);
        var passwordHash = hashPassword(newPassword, salt);
        userSheet.getRange(userRowIdx, 5).setValue(salt);
        userSheet.getRange(userRowIdx, 6).setValue(passwordHash);
        userSheet.getRange(userRowIdx, 7).setValue(''); // bersihkan sandi sementara
      }
      userSheet.getRange(userRowIdx, 10).setValue(new Date().toISOString());

      return { success: true, name: name, avatar: avatar };
    }

    return { success: false, message: 'Pengguna tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Handler HTTP GET: Bisa untuk pratinjau Web App atau Ping API
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    var act = e.parameter.action;
    var res = { success: true, message: 'Google Apps Script Database Aktif 🚀' };
    if (act === 'ping') res = { success: true, timestamp: new Date().toISOString() };
    else if (act === 'checkUser') res = apiCheckUser(e.parameter);

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Hafalan Juz 30 & Hadits Arba\'in Anak Ceria 🌟')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Handler HTTP POST: Menerima permintaan REST API dari Vercel / Web
 */
function doPost(e) {
  try {
    var content = {};
    if (e && e.postData && e.postData.contents) {
      try {
        content = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        content = e.parameter || {};
      }
    } else {
      content = e.parameter || {};
    }

    var action = (content.action || '').toLowerCase().trim();
    var payload = content.payload || content;
    var responseData = { success: false, message: 'Aksi tidak dikenali: ' + action };

    if (action === 'register' || action === 'apiregister') responseData = apiRegister(payload);
    else if (action === 'login' || action === 'apilogin') responseData = apiLogin(payload);
    else if (action === 'checkuser' || action === 'apicheckuser') responseData = apiCheckUser(payload);
    else if (action === 'forgotpassword' || action === 'apiforgotpassword') responseData = apiForgotPassword(payload);
    else if (action === 'saveprogress' || action === 'apisaveprogress') responseData = apiSaveProgress(payload);
    else if (action === 'savebulk' || action === 'apisavebulkprogress') responseData = apiSaveBulkProgress(payload);
    else if (action === 'savehaditsprogress' || action === 'apisavehaditsprogress') responseData = apiSaveHaditsProgress(payload);
    else if (action === 'updateprofile' || action === 'apiupdateprofile') responseData = apiUpdateProfile(payload);

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}