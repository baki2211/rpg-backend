export const isAdmin = (req, res)=> {
    const user = (req).user; 

    if (!user || user.role !== 'admin') {
        res.status(403).json({ message: 'Access denied: Admins only' });
        return;
    }

    next();
};
