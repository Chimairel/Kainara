'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Marquee } from '@/components/ui/Marquee';
import LandingRibbonMeals from './LandingRibbonMeals';
import LandingMealPhoto from './LandingMealPhoto';
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
const mealColumns = Array.from({ length: 5 }, (_, column) => meals.filter((_, index) => index % 5 === column));

export default function LandingMealGallery() {
  const [settledPhotos, setSettledPhotos] = useState<Set<string>>(() => new Set());
  const settlePhoto = useCallback((name: string) => {
    setSettledPhotos((previous) => (previous.has(name) ? previous : new Set(previous).add(name)));
  }, []);
  return (
    <div className={styles.gallery} data-meal-gallery>
      <svg
        className={styles.ribbons}
        viewBox="0 0 1000 780"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-gallery-ribbons
      >
        {/* Bottom ribbon: dropped lower so moving meals clear above it, bleeding to edges with zero gap */}
        <path d="M 1200 395 C 780 640 -300 735 -1200 755 L -1200 1045 C -240 1020 840 895 1200 490 Z" fill="#eb6a38" />
        <path d="M 1200 395 C 780 640 -300 735 -1200 755 L -1200 915 C -260 900 820 790 1200 450 Z" fill="#f09e6c" />
        <path d="M 1200 395 C 780 640 -300 735 -1200 755 L -1200 820 C -280 805 800 705 1200 420 Z" fill="#1b4e41" />
        <LandingRibbonMeals />
      </svg>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.scene}>
          {mealColumns.map((columnMeals, column) => (
            <Marquee
              key={column}
              vertical
              reverse={column % 2 === 1}
              pauseOnHover
              paused={columnMeals.some((meal) => !settledPhotos.has(meal.name))}
              className={styles.column}
              style={{ '--duration': `${48 + column * 8}s` } as CSSProperties}
            >
              {columnMeals.map((meal) => (
                <Card key={meal.name} variant="signal" className={`${styles.card} !border-white/15 !bg-transparent`}>
                  <CardContent className="!p-0">
                    <div className={styles.photo}>
                      <LandingMealPhoto
                        src={`https://panlasangpinoy.com/wp-content/uploads/${meal.photo}`}
                        name={meal.name}
                        onSettled={settlePhoto}
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
    </div>
  );
}
