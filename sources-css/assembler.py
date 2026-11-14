#!/usr/bin/env python3
"""Réassemble juste.css et pages.css.
La tête de chaque feuille (tout ce qui précède la première couche « élan ») est gardée telle quelle : c'est l'assemblage
minifié d'origine. Puis on recolle, dans l'ordre, les couches élan présentes dans sources-css/.
Usage, depuis la racine du site : python3 sources-css/assembler.py"""
import os
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JUSTE = ['elan.css', 'elan-heros.css', 'elan-demo.css', 'elan-nav.css', 'elan-atelier.css']
PAGES = ['pages-elan.css', 'pages-outils.css', 'pages-nav.css']
def refaire(cible, marque, couches):
    p = os.path.join(RACINE, cible); s = open(p, encoding='utf-8').read()
    i = s.find(marque); assert i > 0, (cible, 'marque introuvable')
    corps = ''
    for c in couches:
        f = os.path.join(RACINE, 'sources-css', c)
        if os.path.exists(f): corps += open(f, encoding='utf-8').read().rstrip('\n') + '\n'
    open(p, 'w', encoding='utf-8').write(s[:i].rstrip('\n') + '\n' + corps)
    print(cible, 'tête', i, 'octets + couches', len(corps), 'octets')
refaire('juste.css', '/* JusteCV — couche « élan » : le produit en mouvement.', JUSTE)
refaire('pages.css', '/* JusteCV — couche « élan » des pages de contenu', PAGES)
