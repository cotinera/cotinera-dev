import { useState, useEffect } from 'react';

// A simple hook to access the URL search parameters
export function useSearchParams() {
  const [searchParams, setSearchParams] = useState<URLSearchParams>(
    new URLSearchParams(window.location.search)
  );

  useEffect(() => {
    // Update the state when the URL changes
    const handleURLChange = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    // Listen for popstate event (when user navigates back/forward)
    window.addEventListener('popstate', handleURLChange);

    return () => {
      window.removeEventListener('popstate', handleURLChange);
    };
  }, []);

  // Function to get a parameter value
  const get = (param: string): string | null => {
    return searchParams.get(param);
  };

  // Function to update the URL and state
  const set = (param: string, value: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set(param, value);
    window.history.pushState({}, '', `?${newParams.toString()}`);
    setSearchParams(newParams);
  };

  // Function to remove a parameter
  const remove = (param: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete(param);
    window.history.pushState({}, '', newParams.toString() ? `?${newParams.toString()}` : window.location.pathname);
    setSearchParams(newParams);
  };

  // Function to check if a parameter exists
  const has = (param: string): boolean => {
    return searchParams.has(param);
  };

  return { 
    params: searchParams,
    get,
    set,
    remove,
    has
  };
}