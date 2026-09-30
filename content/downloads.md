---
title: Source Codes & Downloads
page_title: Model Downloads & Source Codes
page_subtitle: Freely available under MIT license in Fortran 90, Windows binary, and WebAssembly.
active_page: downloads
breadcrumbs:
  - name: Downloads & Data
  - name: Downloads
has_sidebar: true
---

## Model Source Codes & Downloads

**FLake** is freely available open-source software distributed under the terms of the **MIT License**. You can download the original Fortran 90 sources, the Windows binary package, or access the modern WebAssembly repository.

> **Zero-Install WebAssembly Edition**  
> Run FLake directly in modern web browsers without installing any compilers or dependencies. The WebAssembly binary is only 27.8 KB and runs entirely on the client side.  
> [Launch Online Model](model/)

## Download Packages

| Package | Format | Size | Contents | Action |
| :--- | :--- | :--- | :--- | :--- |
| **FLake & SfcFlx Sources** | `.tar.gz` | 28 KB | Fortran 90 lake model routines, surface-layer scheme (SfcFlx), and 1D interface. | [Download .tar.gz](assets/downloads/src_flake_sfcflx.tar.gz) |
| **FLake & SfcFlx Sources** | `.zip` | 44 KB | Fortran 90 source files formatted for Windows and cross-platform environments. | [Download .zip](assets/downloads/src_flake_sfcflx.zip) |
| **Windows Executable & Test Run** | `.zip` | 245 KB | Pre-compiled `flake.exe` executable, sample namelists, and forcing datasets. | [Download flake.zip](assets/test_run/flake.zip) |
| **GitHub Repository** | Git / WASM | Online | Full repository with Fortran 90 sources, LFortran build scripts, and WASM web interface. | [View GitHub](https://github.com/taranarmo/flake-lake-model) |

## Quick Compilation Guide

### Compiling to WebAssembly (via LFortran)

The WebAssembly build leverages **LFortran**:

```bash
# Prerequisites: lfortran 0.65.0, llc (llvm-tools), wasm-ld (lld)
./build.sh

# Or using Makefile
make build
```

### Compiling Native Binary (via GNU Fortran)

```bash
# Compile all modules in dependency order
gfortran -O3 -c data_parameters.f90
gfortran -O3 -c flake_derivedtypes.f90
gfortran -O3 -c flake_parameters.f90
gfortran -O3 -c flake_configure.f90
gfortran -O3 -c flake_albedo_ref.f90
gfortran -O3 -c flake_paramoptic_ref.f90
gfortran -O3 -c flake.f90
gfortran -O3 -c SfcFlx.f90
gfortran -O3 -c src_flake_interface_1D.f90
gfortran -O3 *.o -o flake_run
```

## MIT License Terms

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```
