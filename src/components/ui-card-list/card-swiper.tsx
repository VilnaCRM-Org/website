import { Grid } from '@mui/material';
import React, { CSSProperties, useEffect, useRef } from 'react';
import { Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import UiCardItem from '../ui-card-item';

import styles from './styles';
import 'swiper/css';
import 'swiper/css/pagination';
import { CardList } from './types';

type SwiperRef = React.RefObject<HTMLDivElement | null>;

const OBSERVER_CONFIG: MutationObserverInit = {
  childList: true,
};

function isToolTip(node: Element): boolean {
  return node.role === 'tooltip' && node.classList.contains('base-Popper-root');
}

function setSwiperPointerEvents(swiperRef: SwiperRef, value: string): void {
  // Intentional DOM mutation through the carousel ref so a tooltip popper stays
  // interactive over the swiper. Aliased to a local so it is not a param write.
  const element: HTMLDivElement | null = swiperRef.current;
  if (element) {
    element.style.pointerEvents = value;
  }
}

function applyToTooltipNodes(nodes: NodeList, swiperRef: SwiperRef, value: string): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node: Node = nodes[i];
    if (node instanceof Element && isToolTip(node)) {
      setSwiperPointerEvents(swiperRef, value);
    }
  }
}

function createTooltipObserver(swiperRef: SwiperRef): MutationObserver {
  return new MutationObserver((mutationsList: MutationRecord[]) => {
    for (let i = 0; i < mutationsList.length; i += 1) {
      const mutation: MutationRecord = mutationsList[i];
      if (mutation.type === 'childList') {
        applyToTooltipNodes(mutation.addedNodes, swiperRef, 'none');
        applyToTooltipNodes(mutation.removedNodes, swiperRef, 'auto');
      }
    }
  });
}

// Disables Swiper pointer events while a tooltip popper is mounted, so the
// tooltip stays interactive over the carousel. Mouse-only by design.
function useTooltipPointerGuard(swiperRef: SwiperRef, cardCount: number): void {
  useEffect(() => {
    if (cardCount === 0) {
      return undefined;
    }

    const target: HTMLElement | null = document.querySelector('body');
    const observer: MutationObserver = createTooltipObserver(swiperRef);

    if (target) {
      observer.observe(target, OBSERVER_CONFIG);
    }

    return () => observer.disconnect();
  }, [cardCount, swiperRef]);
}

function CardSlides({ cardList, hoverCardContent }: CardList): React.ReactElement {
  return (
    <Swiper
      pagination={{
        clickable: true,
      }}
      modules={[Pagination]}
      spaceBetween={12}
      slidesPerView={1.04}
      loop
      className="swiper-wrapper"
    >
      {cardList.map(item => (
        <SwiperSlide key={item.id}>
          <UiCardItem item={item} hoverCardContent={hoverCardContent} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

function CardSwiper({ cardList, hoverCardContent }: CardList): React.ReactElement | null {
  const swiperRef = useRef<HTMLDivElement>(null);
  useTooltipPointerGuard(swiperRef, cardList.length);

  if (cardList.length === 0) {
    return null;
  }

  const gridMobile: CSSProperties =
    cardList[0].type === 'smallCard' ? styles.gridSmallMobile : styles.gridLargeMobile;

  return (
    <Grid sx={gridMobile} ref={swiperRef as React.RefObject<HTMLDivElement>}>
      <CardSlides cardList={cardList} hoverCardContent={hoverCardContent} />
    </Grid>
  );
}

export default CardSwiper;
