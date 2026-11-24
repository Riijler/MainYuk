function cekLogin(req, res, next) {
  if (!req.session.pengguna) {
    return res.redirect('/login');
  }

  next();
}

module.exports = cekLogin;
