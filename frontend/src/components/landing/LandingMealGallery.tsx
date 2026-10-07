'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Marquee } from '@/components/ui/Marquee';
import styles from './LandingMealGallery.module.css';

// Public display-only photo mappings already used by the Panlasang library image resolver.
// This gallery does not imply that a recipe is eligible or approved for a member.
const meals = [
  { name: 'Menudo', source: 'menudo-with-raisins-and-green-peas', photo: '2014/04/Filipino-Menudo.jpg' },
  {
    name: 'Pancit Malabon',
    source: 'pancit-malabon-recipe',
    photo: '2018/01/Pancit-Malabon-Recipe-Panlasang-Pinoy.jpg',
  },
  { name: 'Chicken Tinola', source: 'filipino-chicken-tinola-recipe', photo: '2018/11/Chicken-Tinola.jpg' },
  { name: 'Chicken Sopas', source: 'filipino-chicken-macaroni-sopas', photo: '2014/10/Filipinpo-Chicken-Sopas-YT.jpg' },
  { name: 'Pork Adobo', source: 'pork-adobo-with-boiled-eggs', photo: '2012/10/Pork-adobo-with-boiled-eggs.jpg' },
  {
    name: 'Sinigang na Bangus',
    source: 'sinigang-na-bangus-recipe',
    photo: '2018/06/sinigang-na-bangus-recipe-filipino.jpg',
  },
  { name: 'Filipino Spaghetti', source: 'filipino-style-spaghetti', photo: '2015/05/Filipino-spaghetti-recipe-1.jpg' },
  { name: 'Sinampalukang Manok', source: 'sinampalukang-manok', photo: '2011/10/Sinampalukang-Manok.jpg' },
  { name: 'Pata Humba', source: 'pork-pata-humba-ham-hock-filipino-recipe', photo: '2025/08/Pata-humba-recipe.jpg' },
  { name: 'Pork Steak', source: 'pork-steak-recip', photo: '2011/02/Pork-Steak-Recipe-jpg.webp' },
  { name: 'Paksiw na Pata', source: 'pata-paksiw-recipe', photo: '2009/07/Paksiw-na-Pata.jpg' },
  { name: 'Menudo sa Gata', source: 'pork-menudo-sa-gata-recipe', photo: '2021/03/pork-menudo-sa-gata.jpg' },
  { name: 'Buffalo Chicken Wings', source: 'buffalo-chicken-wings', photo: '2018/08/buffalo-chicken-wing_.jpg' },
  {
    name: 'Lengua in Mushroom Sauce',
    source: 'lengua-in-white-mushroom-sauce',
    photo: '2017/01/Lengua-in-White-Mushroom-Sauce-Recipe.jpg',
  },
  { name: 'Lengua Estofado', source: 'lengua-estofado-recipe', photo: '2016/12/How-to-Cook-Lengua-Estofado_.jpg' },
  { name: 'Pork & Chicken Adobo', source: 'pork-and-chicken-adobo', photo: '2011/10/Pork-and-Chicken-Adobo-1.jpg' },
];

// Each recipe belongs to exactly one column. Marquee repeats only within that column for its seamless loop.
const mealColumns = Array.from({ length: 4 }, (_, column) => meals.filter((_, index) => index % 4 === column));

export default function LandingMealGallery() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={styles.gallery} data-meal-gallery>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.scene}>
          {mealColumns.map((columnMeals, column) => (
            <Marquee
              key={column}
              vertical
              reverse={column % 2 === 1}
              paused={paused}
              pauseOnHover
              className={styles.column}
              style={{ '--duration': `${48 + column * 8}s` } as CSSProperties}
            >
              {columnMeals.map((meal) => (
                <Card key={meal.name} variant="signal" className={`${styles.card} !border-white/15 !bg-transparent`}>
                  <CardContent className="!p-0">
                    <div className={styles.photo}>
                      <Image
                        src={`https://panlasangpinoy.com/wp-content/uploads/${meal.photo}`}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 15vw, (min-width: 640px) 155px, 110px"
                        className="object-cover"
                      />
                      <div className={styles.caption}>
                        <p className={styles.mealName}>{meal.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </Marquee>
          ))}
        </div>
      </div>
      <div className="relative z-10 flex items-start justify-between gap-3 px-3 text-left">
        <details className={styles.credits}>
          <summary className="cursor-pointer text-xs text-brand-muted">Recipes & photos: Panlasang Pinoy</summary>
          <ul className="mt-3 space-y-2 text-xs text-brand-muted">
            {meals.map(({ name, source }) => (
              <li key={name}>
                <a
                  href={`https://panlasangpinoy.com/${source}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {name} — Panlasang Pinoy
                </a>
              </li>
            ))}
          </ul>
        </details>
        <button
          type="button"
          className={`${styles.pause} flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 text-xs font-semibold text-brand-text`}
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Resume meal gallery' : 'Pause meal gallery'}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
}
