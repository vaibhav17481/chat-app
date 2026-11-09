import jwt from "jsonwebtoken";

export const protectRoute = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Unauthorized - No Token",
    });
  }

  const [scheme, token] = authHeader.split(" ");

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({
      message: "Unauthorized - Malformed Token",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    return next();
  } catch (error) {
    const message =
      error?.name === "TokenExpiredError"
        ? "Unauthorized - Token Expired"
        : "Unauthorized - Invalid Token";

    return res.status(401).json({
      message,
    });
  }
};
