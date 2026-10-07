'use client';

import { type CSSProperties } from 'react';
import Image from 'next/image';
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
const mealColumns = Array.from({ length: 5 }, (_, column) => meals.filter((_, index) => index % 5 === column));

export default function LandingMealGallery() {
  return (
    <div className={styles.gallery} data-meal-gallery>
      <svg
        className={styles.ribbons}
        viewBox="0 0 1000 780"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
        data-gallery-ribbons
      >
        <path d="M520 -58 C880 -58 1075 5 1075 260 C1075 545 1045 675 685 805" stroke="#eb6a38" strokeWidth="36" />
        <path d="M520 -24 C850 -24 1041 35 1041 260 C1041 520 1015 650 674 773" stroke="#f09e6c" strokeWidth="36" />
        <path d="M520 10 C820 10 1007 65 1007 260 C1007 495 985 625 663 741" stroke="#1b4e41" strokeWidth="36" />
      </svg>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.scene}>
          {mealColumns.map((columnMeals, column) => (
            <Marquee
              key={column}
              vertical
              reverse={column % 2 === 1}
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
    </div>
  );
}
