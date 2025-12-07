import React from "react";

// Create a context to share greeting loading state between ThreadList and Thread
export const GreetingLoadingContext = React.createContext<{
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}>({ isLoading: false, setIsLoading: () => {} });
