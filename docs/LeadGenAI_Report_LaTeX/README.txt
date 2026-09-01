LeadGenAI - Detailed Project Report (LaTeX source)

Build:
    pdflatex LeadGenAI_Report.tex
    pdflatex LeadGenAI_Report.tex
    pdflatex LeadGenAI_Report.tex

Run three times so the table of contents, list of figures, list of
tables and the "Page N of M" footer all resolve.

Requires pdflatex with: charter, helvet, tikz, tcolorbox, tabularx,
booktabs, enumitem, microtype, titlesec, fancyhdr, lastpage,
listings, caption, hyperref.

figures/  holds the 14 application screenshots referenced by the
          \uifig commands. Every other diagram is drawn inline with
          TikZ, so there are no other external image dependencies.

To swap a screenshot, drop a replacement into figures/ under the same
filename and rebuild. To change a figure's size, edit the second
argument of its \uifig call (a fraction of the text width).
