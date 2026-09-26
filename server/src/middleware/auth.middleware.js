import jwt from "jsonwebtoken";

export const protectRoute = (req, res, next) => {
  try {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
  return res.status(401).json({
    message: "Unauthorized - No Token",
  });
}

   const token = authHeader.split(" ")[1];
   
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};