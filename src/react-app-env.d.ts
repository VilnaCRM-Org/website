declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';
declare module '*.svg?url' {
  const content: string;
  export default content;
}