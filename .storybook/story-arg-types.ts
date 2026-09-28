export interface TextArgType {
  type: 'string';
  description: string;
}

export const textArgType = (description: string): TextArgType => ({
  type: 'string',
  description,
});
