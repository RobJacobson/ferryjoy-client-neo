import { usePathname } from "expo-router";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type NavigationHistoryContextType = {
  previousPathname: string | null;
  currentPathname: string;
};

const NavigationHistoryContext = createContext<
  NavigationHistoryContextType | undefined
>(undefined);

export const NavigationHistoryProvider = ({ children }: PropsWithChildren) => {
  const pathname = usePathname();

  const currentRef = useRef<string>(pathname);

  const [previousPathname, setPreviousPathname] = useState<string | null>(null);
  const [currentPathname, setCurrentPathname] = useState<string>(pathname);

  useEffect(() => {
    setPreviousPathname(currentRef.current);
    setCurrentPathname(pathname);
    currentRef.current = pathname;
  }, [pathname]);

  const value = { previousPathname, currentPathname };

  return (
    <NavigationHistoryContext value={value}>
      {children}
    </NavigationHistoryContext>
  );
};

export const useNavigationHistory = () => {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error(
      "useNavigationHistory must be used within NavigationHistoryProvider"
    );
  }
  return context;
};
