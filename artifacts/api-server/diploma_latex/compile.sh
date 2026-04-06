#!/bin/bash
# =============================================================
# ШУТИС Дипломын ажлыг хэвлэх скрипт
# Ажиллуулах: chmod +x compile.sh && ./compile.sh
# =============================================================

echo "=== Дипломын ажлыг хэвлэж байна (pdflatex + bibtex) ==="

# 1-р давалт: pdflatex (crossref болон toc үүсгэнэ)
pdflatex -interaction=nonstopmode main.tex

# bibtex: ном зүй боловсруулна
bibtex main

# 2-р давалт: ном зүй ба crossref шийдвэрлэнэ
pdflatex -interaction=nonstopmode main.tex

# 3-р давалт: бүх crossref тогтворжно
pdflatex -interaction=nonstopmode main.tex

echo ""
echo "=== Хэвлэлт дуусав: main.pdf файлыг шалгана уу ==="
