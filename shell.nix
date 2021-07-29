{ pkgs ? import <nixpkgs> { } }:
with pkgs;
mkShell {
  buildInputs = [
    nodejs
    nodePackages.typescript-language-server
    nodePackages.typescript
  ];
}
