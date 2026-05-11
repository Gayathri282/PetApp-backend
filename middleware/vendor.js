const vendor = (req, res, next) => {
  if (req.user && (req.user.role === 'vendor' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Vendor or admin access required' });
};

module.exports = vendor;
