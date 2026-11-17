export interface TokenValue {
  papel: string;
  grafite?: string;
}

export interface DesignTokens {
  color: { tokens: { name: string; value: TokenValue }[] };
  type: {
    groups: {
      family: string;
      styles: {
        name: string;
        fontSize: string;
        lineHeight: string;
        fontWeight: number;
        fontStyle: string;
        letterSpacing?: string;
      }[];
    }[];
  };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
  shadow: { tokens: { name: string; value: TokenValue }[] };
}

export function generateTokensCss(tokens: DesignTokens): string;
