declare namespace JSX {
  interface IntrinsicElements {
    "model-viewer": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "camera-controls"?: boolean;
        "touch-action"?: string;
        "auto-rotate"?: boolean;
        "shadow-intensity"?: string;
        poster?: string;
        loading?: string;
      },
      HTMLElement
    >;
  }
}
