const fallbackNavigate: (url: string) => void = (url: string): void => {
  window.location.assign(url);
};

export default fallbackNavigate;
