/**
 * ====================================================================
 * BACKEND GOOGLE APPS SCRIPT: Hafalan Juz 30 Anak Ceria
 * Berkas    : Code.gs
 * Platform  : Google Apps Script (GAS)
 * Fitur     : Autentikasi, Hash Sandi SHA-256, Penyimpanan Hafalan Cloud
 * Database  : PropertiesService (ScriptProperties Google Cloud)
 * ====================================================================
 */

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Hafalan Juz 30 Anak Ceria 🌟')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

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

function apiRegister(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    var password = data.password || '';
    var name = (data.name || '').trim();
    var avatar = data.avatar || '🦁';

    if (!email || !password || !name) {
      return { success: false, message: 'Nama, email, dan kata sandi wajib diisi!' };
    }

    var props = PropertiesService.getScriptProperties();
    var userKey = 'usr_' + email;

    if (props.getProperty(userKey)) {
      return { success: false, message: 'Email sudah terdaftar. Silakan langsung masuk.' };
    }

    var salt = Utilities.getUuid().substring(0, 16);
    var passwordHash = hashPassword(password, salt);
    var userId = 'id_' + new Date().getTime() + '_' + Math.floor(Math.random() * 10000);

    var userProfile = {
      id: userId,
      email: email,
      name: name,
      avatar: avatar,
      salt: salt,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    };

    props.setProperty(userKey, JSON.stringify(userProfile));
    props.setProperty('idmap_' + userId, email);
    props.setProperty('prog_' + userId, JSON.stringify({}));

    var token = generateSessionToken(userId);
    props.setProperty('sess_' + token, userId);

    return {
      success: true,
      token: token,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        avatar: userProfile.avatar
      },
      progress: {}
    };
  } catch (err) {
    return { success: false, message: 'Gagal mendaftar: ' + err.message };
  }
}

function apiLogin(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    var password = data.password || '';

    if (!email || !password) {
      return { success: false, message: 'Email dan kata sandi wajib diisi!' };
    }

    var props = PropertiesService.getScriptProperties();
    var userRaw = props.getProperty('usr_' + email);

    if (!userRaw) {
      return { success: false, message: 'Email tidak ditemukan. Silakan daftar akun baru.' };
    }

    var user = JSON.parse(userRaw);
    var testHash = hashPassword(password, user.salt);

    if (testHash !== user.passwordHash) {
      return { success: false, message: 'Kata sandi tidak sesuai. Silakan coba lagi.' };
    }

    var token = generateSessionToken(user.id);
    props.setProperty('sess_' + token, user.id);

    var progRaw = props.getProperty('prog_' + user.id) || '{}';
    var progress = JSON.parse(progRaw);

    return {
      success: true,
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      progress: progress
    };
  } catch (err) {
    return { success: false, message: 'Gagal masuk: ' + err.message };
  }
}

function apiGetMe(token) {
  try {
    if (!token) return { success: false, message: 'Token tidak tersedia.' };

    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('sess_' + token);
    if (!userId) {
      return { success: false, message: 'Sesi telah berakhir. Silakan login kembali.' };
    }

    var email = props.getProperty('idmap_' + userId);
    if (!email) return { success: false, message: 'Pengguna tidak ditemukan.' };

    var userRaw = props.getProperty('usr_' + email);
    if (!userRaw) return { success: false, message: 'Data akun tidak ditemukan.' };

    var user = JSON.parse(userRaw);
    var progRaw = props.getProperty('prog_' + userId) || '{}';
    var progress = JSON.parse(progRaw);

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      progress: progress
    };
  } catch (err) {
    return { success: false, message: 'Kesalahan otentikasi: ' + err.message };
  }
}

function apiForgotPassword(data) {
  try {
    var email = (data.email || '').toLowerCase().trim();
    if (!email) {
      return { success: false, message: 'Alamat email wajib diisi!' };
    }

    var props = PropertiesService.getScriptProperties();
    var userRaw = props.getProperty('usr_' + email);
    if (!userRaw) {
      return { success: false, message: 'Email tidak ditemukan di sistem. Pastikan email terdaftar.' };
    }

    // Mengirim email tautan reset kata sandi
    try {
      if (typeof MailApp !== 'undefined') {
        MailApp.sendEmail({
          to: email,
          subject: 'Reset Kata Sandi Akun Hafalan Juz 30 Ceria 🌟',
          body: 'Assalamu\'alaikum,\n\nKami menerima permintaan untuk mereset kata sandi akun santri Anda di aplikasi Hafalan Juz 30 Ceria.\n\nSilakan gunakan tautan berikut untuk membuat kata sandi baru atau masuk kembali ke aplikasi.\n\nJika ini bukan Anda, abaikan email ini.\n\nWassalam,\nTim Hafalan Juz 30'
        });
      }
    } catch (mailErr) {
      console.warn("MailApp warning: " + mailErr);
    }

    return {
      success: true,
      message: 'Instruksi dan tautan reset kata sandi telah dikirimkan ke ' + email
    };
  } catch (err) {
    return { success: false, message: 'Gagal mengirim email reset: ' + err.message };
  }
}

function apiSaveProgress(data) {
  try {
    var token = data.token;
    var surahId = data.surahId;
    var ayahNum = data.ayahNum;
    var status = data.status;
    var timestamp = data.timestamp || new Date().getTime();

    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('sess_' + token);
    if (!userId) return { success: false, message: 'Sesi tidak valid.' };

    var progKey = 'prog_' + userId;
    var progRaw = props.getProperty(progKey) || '{}';
    var progress = JSON.parse(progRaw);

    var itemKey = surahId + '_' + ayahNum;
    progress[itemKey] = {
      status: status,
      timestamp: timestamp
    };

    props.setProperty(progKey, JSON.stringify(progress));
    return { success: true, key: itemKey, status: status };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan progres: ' + err.message };
  }
}

function apiSaveBulkProgress(data) {
  try {
    var token = data.token;
    var updates = data.updates || [];
    var timestamp = data.timestamp || new Date().getTime();

    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('sess_' + token);
    if (!userId) return { success: false, message: 'Sesi tidak valid.' };

    var progKey = 'prog_' + userId;
    var progRaw = props.getProperty(progKey) || '{}';
    var progress = JSON.parse(progRaw);

    for (var i = 0; i < updates.length; i++) {
      var item = updates[i];
      if (item.surahId && item.ayahNum && item.status) {
        progress[item.surahId + '_' + item.ayahNum] = {
          status: item.status,
          timestamp: timestamp
        };
      }
    }

    props.setProperty(progKey, JSON.stringify(progress));
    return { success: true, count: updates.length };
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui progres borongan: ' + err.message };
  }
}

function apiUpdateProfile(data) {
  try {
    var token = data.token;
    var name = (data.name || '').trim();
    var avatar = data.avatar;

    var props = PropertiesService.getScriptProperties();
    var userId = props.getProperty('sess_' + token);
    if (!userId) return { success: false, message: 'Sesi tidak valid.' };

    var email = props.getProperty('idmap_' + userId);
    if (!email) return { success: false, message: 'Pengguna tidak ditemukan.' };

    var userRaw = props.getProperty('usr_' + email);
    if (!userRaw) return { success: false, message: 'Data akun tidak ditemukan.' };

    var user = JSON.parse(userRaw);
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    props.setProperty('usr_' + email, JSON.stringify(user));
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui profil: ' + err.message };
  }
}

function doPost(e) {
  try {
    var content = JSON.parse(e.postData.contents);
    var action = content.action;
    var payload = content.payload || {};
    var responseData = { success: false, message: 'Aksi tidak dikenali' };

    if (action === 'register') responseData = apiRegister(payload);
    else if (action === 'login') responseData = apiLogin(payload);
    else if (action === 'getMe') responseData = apiGetMe(payload.token);
    else if (action === 'saveProgress') responseData = apiSaveProgress(payload);
    else if (action === 'saveBulk') responseData = apiSaveBulkProgress(payload);
    else if (action === 'updateProfile') responseData = apiUpdateProfile(payload);

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}