const vendor = (req, res, next) => {
  if (req.user && req.user.role === 'vendor' && req.user.vendorApproved) {
    return next();
  }
  return res.status(403).json({ message: 'Approved vendor access required' });
};

module.exports = vendor;
