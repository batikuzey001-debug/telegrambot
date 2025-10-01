export function makeAuth(adminToken){
  return function auth(req,res,next){
    if (req.headers.authorization !== `Bearer ${adminToken}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  };
}
