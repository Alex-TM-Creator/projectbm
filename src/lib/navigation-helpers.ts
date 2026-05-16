
export const getSafePath = (path?: string) => {
    if (!path) return "#";
    // If the path is absolute (starts with '/'), use it directly.
    // Otherwise, prepend '/dashboard/'.
    return path.startsWith('/') ? path : `/dashboard/${path}`;
  };
