/**
 * ====================================================================
 * BACKEND GOOGLE APPS SCRIPT: Hafalan Juz 30 & Hadits Arba'in
 * Berkas    : Code.js (Code.gs)
 * Platform  : Google Apps Script (GAS)
 * Database  : Google Spreadsheet (Hanya Data User & Password Akun)
 * Fungsi    : Menyimpan data pengguna & kata sandi di Google Sheets
 *             untuk mengetahui user sudah terdaftar atau belum.
 *             Data hafalan tetap disimpan di cache/internal device.
 * ====================================================================
 */

// Nama tunggal sheet di Google Spreadsheet
var SHEET_USERS = 'Santri_Users';

/**
 * Mendapatkan atau menginisialisasi Google Spreadsheet sebagai Database Akun
 */
function getDatabaseSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SPREADSHEET_ID');

  var ss = null;
  if (sheetId) {
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch (e) {
      console.warn("Gagal membuka spreadsheet via ID tersimpan:", e);
    }
  }

  // Jika script terikat langsung pada Google Sheet (Ekstensi -> Apps Script)
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        props.setProperty('SPREADSHEET_ID', ss.getId());
      }
    } catch (e) {}
  }

  // Jika belum ada, buat Spreadsheet baru otomatis di Google Drive
  if (!ss) {
    try {
      ss = SpreadsheetApp.create('Database Akun Santri Juz 30 🌟');
      props.setProperty('SPREADSHEET_ID', ss.getId());
      console.log("Berhasil membuat Spreadsheet baru: " + ss.getUrl());
    } catch (createErr) {
      console.error("Gagal membuat Spreadsheet otomatis:", createErr);
    }
  }

  if (ss) {
    setupUserTable(ss);
  }

  return ss;
}

/**
 * Inisialisasi Header tabel Santri_Users jika belum ada
 */
function setupUserTable(ss) {
  if (!ss) return;

  var sheetUsers = ss.getSheetByName(SHEET_USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEET_USERS);
    sheetUsers.appendRow([
      'User ID',
      'Nama Santri',
      'Email',
      'Kata Sandi',
      'Kata Sandi Sementara',
      'Avatar',
      'Auth Provider',
      'Tanggal Daftar',
      'Terakhir Aktif'
    ]);

    try {
      var range = sheetUsers.getRange(1, 1, 1, 9);
      range.setBackground('#059669'); // Warna Hijau Zamrud
      range.setFontColor('#ffffff');
      range.setFontWeight('bold');
      sheetUsers.setFrozenRows(1);
      for (var c = 1; c <= 9; c++) {
        sheetUsers.autoResizeColumn(c);
      }
    } catch (e) {}
  }
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

    // Cek apakah email sudah terdaftar di Google Sheets
    if (userSheet) {
      var dataValues = userSheet.getDataRange().getValues();
      for (var i = 1; i < dataValues.length; i++) {
        var existingEmail = (dataValues[i][2] || '').toString().toLowerCase().trim();
        if (existingEmail === email) {
          return { success: false, message: 'Email sudah terdaftar. Silakan langsung masuk.' };
        }
      }
    }

    var userId = 'id_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
    var nowIso = new Date().toISOString();

    // Simpan data user & password ke baris Google Sheets
    if (userSheet) {
      userSheet.appendRow([
        userId,
        name,
        email,
        password,
        '', // kata sandi sementara kosong awal
        avatar,
        authProvider,
        nowIso,
        nowIso
      ]);
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
        name: name,
        email: email,
        avatar: avatar,
        authProvider: authProvider
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal mendaftar: ' + err.message };
  }
}

/**
 * API: Login Santri - Verifikasi email & password dari Google Sheets
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
      return { success: false, message: 'Database Spreadsheet belum siap.' };
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

    if (!userRow) {
      return {
        success: false,
        message: 'Akun Anda belum terdaftar di aplikasi. Silakan periksa kembali email Anda atau buat akun baru terlebih dahulu.'
      };
    }

    var userId = userRow[0];
    var userName = userRow[1];
    var storedPassword = (userRow[3] || '').toString();
    var tempPassword = (userRow[4] || '').toString();
    var userAvatar = userRow[5];

    var isPasswordMatch = (password === storedPassword);
    var isTempPasswordMatch = (tempPassword && password === tempPassword);

    if (!isPasswordMatch && !isTempPasswordMatch) {
      return { success: false, message: 'Kata sandi salah. Silakan periksa kembali.' };
    }

    // Jika masuk menggunakan kata sandi sementara, perbarui kata sandi utama dan bersihkan sandi sementara
    if (isTempPasswordMatch && !isPasswordMatch) {
      try {
        userSheet.getRange(userRowIdx, 4).setValue(password);
        userSheet.getRange(userRowIdx, 5).setValue('');
      } catch (e) {}
    }

    // Perbarui waktu Terakhir Aktif di kolom 9
    try {
      userSheet.getRange(userRowIdx, 9).setValue(new Date().toISOString());
    } catch (e) {}

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
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal masuk: ' + err.message };
  }
}

/**
 * API: Cek apakah user sudah terdaftar di Google Sheets
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
            avatar: dataValues[i][5]
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
 * API: Lupa Kata Sandi - Buat sandi sementara & update Google Sheets
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

    // Gunakan kata sandi sementara yang dikirim atau buat acak
    var tempPassword = (data.tempPassword || '').trim();
    if (!tempPassword) {
      var randomCode = Math.floor(1000 + Math.random() * 9000);
      tempPassword = 'Juz30-' + randomCode;
    }

    var userName = userRow ? userRow[1] : (data.name || email.split('@')[0] || 'Santri Hebat');

    // Jika akun belum terdaftar di spreadsheet, auto-sinkronkan agar akun langsung terdaftar
    if (!userRow) {
      var newUserId = 'id_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);
      var nowIso = new Date().toISOString();
      userSheet.appendRow([
        newUserId,
        userName,
        email,
        tempPassword,
        tempPassword,
        (data.avatar || '🦁'),
        'email',
        nowIso,
        nowIso
      ]);
    } else {
      // Perbarui kata sandi aktif dan kata sandi sementara
      userSheet.getRange(userRowIdx, 4).setValue(tempPassword);
      userSheet.getRange(userRowIdx, 5).setValue(tempPassword);
      try {
        userSheet.getRange(userRowIdx, 9).setValue(new Date().toISOString());
      } catch (e) {}
    }

    // 3. Tautan Masuk Otomatis
    var appUrl = 'https://hafalan-juz30-two.vercel.app';
    var magicLoginUrl = appUrl + '?quick_login=true&email=' + encodeURIComponent(email) + '&key=' + encodeURIComponent(tempPassword);

    // 4. Kirim notifikasi via Gmail (jika MailApp aktif)
    try {
      if (typeof MailApp !== 'undefined') {
        var htmlContent = ''
          + '<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">'
          + '  <h2 style="color: #059669; text-align: center; margin-top: 0;">Generasi Cerdas • Metode Ummi 🌟</h2>'
          + '  <p style="font-size: 14px; color: #334155;">Assalamu\'alaikum <b>' + (userName || 'Sahabat') + '</b>,</p>'
          + '  <p style="font-size: 14px; color: #334155;">Berikut adalah kata sandi sementara akun santri Anda:</p>'
          + '  <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 14px; text-align: center; margin: 16px 0;">'
          + '    <span style="font-size: 24px; font-weight: bold; color: #065f46; letter-spacing: 2px; font-family: monospace;">' + tempPassword + '</span>'
          + '  </div>'
          + '  <div style="text-align: center; margin: 18px 0;">'
          + '    <a href="' + magicLoginUrl + '" style="background-color: #059669; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Masuk Otomatis Sekarang 🚀</a>'
          + '  </div>'
          + '  <p style="font-size: 12px; color: #64748b;">Kata sandi ini dapat diubah di menu profil setelah Anda masuk.</p>'
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
 * API: Update Profil di Google Sheets (Nama, Avatar, atau Sandi Baru)
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
      if (avatar) userSheet.getRange(userRowIdx, 6).setValue(avatar);
      if (newPassword) {
        userSheet.getRange(userRowIdx, 4).setValue(newPassword);
        userSheet.getRange(userRowIdx, 5).setValue(''); // bersihkan sandi sementara
      }
      userSheet.getRange(userRowIdx, 9).setValue(new Date().toISOString());

      return { success: true, name: name, avatar: avatar };
    } else if (email) {
      // Auto-sinkronkan akun baru jika belum ada di spreadsheet
      var newUserId = userId || ('id_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000));
      var nowIso = new Date().toISOString();
      userSheet.appendRow([
        newUserId,
        name || email.split('@')[0] || 'Santri Hebat',
        email,
        newPassword || '',
        '',
        avatar || '🦁',
        'email',
        nowIso,
        nowIso
      ]);
      return { success: true, name: name, avatar: avatar };
    }

    return { success: false, message: 'Pengguna tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    var act = e.parameter.action;
    var res = { success: true, message: 'Google Apps Script Database Akun Aktif 🚀' };
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
    else if (action === 'updateprofile' || action === 'apiupdateprofile') responseData = apiUpdateProfile(payload);

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}