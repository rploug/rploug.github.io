declare module 'dom-to-image-more' {
  function toPng(node: Node, options?: object): Promise<string>;
  function toJpeg(node: Node, options?: object): Promise<string>;
  function toBlob(node: Node, options?: object): Promise<Blob>;
  function toSvg(node: Node, options?: object): Promise<string>;
  export { toPng, toJpeg, toBlob, toSvg };
}
