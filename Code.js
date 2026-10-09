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

    var user = JSON.parse(userRaw);

    // 1. Buat kata sandi acak sementara (contoh: Juz30-8492)
    var randomCode = Math.floor(1000 + Math.random() * 9000);
    var tempPassword = 'Juz30-' + randomCode;

    // 2. Perbarui kata sandi pengguna dengan sandi sementara
    user.salt = Utilities.getUuid().substring(0, 16);
    user.passwordHash = hashPassword(tempPassword, user.salt);
    props.setProperty('usr_' + email, JSON.stringify(user));

    // 3. Buat tautan masuk otomatis (Magic Link)
    var appUrl = 'https://hafalan-juz30-two.vercel.app';
    try {
      if (typeof ScriptApp !== 'undefined' && ScriptApp.getService()) {
        appUrl = ScriptApp.getService().getUrl() || appUrl;
      }
    } catch (e) {}

    var magicLoginUrl = appUrl + '?quick_login=true&email=' + encodeURIComponent(email) + '&key=' + encodeURIComponent(tempPassword);

    // 4. Kirim email nyata ke akun Gmail pengguna
    try {
      if (typeof MailApp !== 'undefined') {
        var htmlContent = ''
          + '<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">'
          + '  <div style="text-align: center; margin-bottom: 20px;">'
          + '    <h1 style="color: #059669; margin: 0; font-size: 22px;">Generasi Cerdas • Metode Ummi 🌟</h1>'
          + '    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Hafalan Al-Qur\'an Juz 30 & Hadits Arba\'in</p>'
          + '  </div>'
          + '  <p style="font-size: 14px; color: #334155;">Assalamu\'alaikum <b>' + (user.name || 'Sahabat Cilik') + '</b>,</p>'
          + '  <p style="font-size: 14px; color: #334155; line-height: 1.6;">Kami menerima permintaan pengaturan ulang kata sandi untuk akun santri Anda. Kami telah membuatkan <b>kata sandi sementara</b> berikut agar Anda dapat langsung masuk:</p>'
          + '  <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">'
          + '    <span style="font-size: 12px; color: #047857; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 6px;">Kata Sandi Sementara Anda:</span>'
          + '    <span style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #065f46; font-family: monospace;">' + tempPassword + '</span>'
          + '  </div>'
          + '  <div style="text-align: center; margin: 24px 0;">'
          + '    <a href="' + magicLoginUrl + '" style="background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Masuk Otomatis ke Aplikasi 🚀</a>'
          + '  </div>'
          + '  <p style="font-size: 12px; color: #64748b; line-height: 1.5;"><b>💡 Tips Keamanan:</b> Setelah berhasil masuk, Anda dapat langsung mengganti kata sandi ini dengan sandi baru sesuai keinginan Anda melalui menu <b>Pengaturan Profil (Edit Profil)</b>.</p>'
          + '  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />'
          + '  <p style="font-size: 11px; color: #94a3b8; text-align: center;">Jika Anda tidak merasa meminta reset kata sandi ini, silakan abaikan email ini.</p>'
          + '</div>';

        MailApp.sendEmail({
          to: email,
          subject: '🔑 Kata Sandi Baru & Tautan Masuk Akun Hafalan Juz 30',
          htmlBody: htmlContent,
          body: 'Assalamu\'alaikum ' + (user.name || 'Sahabat') + ',\n\nKata sandi sementara akun Anda adalah: ' + tempPassword + '\n\nAtau klik tautan berikut untuk masuk otomatis:\n' + magicLoginUrl + '\n\nSegera ubah kata sandi di menu profil setelah berhasil masuk.'
        });
      }
    } catch (mailErr) {
      console.warn("MailApp warning: " + mailErr);
    }

    return {
      success: true,
      tempPassword: tempPassword,
      magicLoginUrl: magicLoginUrl,
      message: 'Kata sandi sementara dan tautan masuk telah dikirimkan ke ' + email
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
    else if (action === 'forgotPassword') responseData = apiForgotPassword(payload);

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}