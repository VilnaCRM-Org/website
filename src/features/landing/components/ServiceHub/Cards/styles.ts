export const cardsStyles = {
  wrapper: {
    '@media (max-width: 425.98px)': {
      position: 'relative',
      zIndex: '5',
      marginTop: '315px',
      padding: '32px 24px',
      borderRadius: '24px 24px 0px 0px',
      background: '#FFF',
      boxShadow: '0px -15px 24px 0px rgba(108, 120, 132, 0.25)',
    },
  },

  cardWrapper: {
    flexDirection: 'row',
    '@media (max-width: 425.98px)': { flexDirection: 'column' },
  },
  cardItem: {
    zIndex: '4',
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
    padding: '27px 32px',
    borderRadius: '12px',
    border: '1px solid  #EAECEE',
    background: '#FFF',
    boxShadow: '0px 8px 27px 0px rgba(49, 59, 67, 0.14)',
    '@media (max-width: 1130.98px)': {
      padding: '29px 32px ',
    },
    '@media (max-width: 425.98px)': {
      border: 'none',
      boxShadow: 'none',
      flexDirection: 'row',
      padding: '0',
      width: '100%',
    },
  },
  secondTitle: {
    pb: '32px',
    color: '#1A1C1E',
    fontFamily: 'Stolzl',
    fontSize: '28px',
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 'normal',
    pt: '153px',
    '@media (max-width: 1130.98px)': {
      pt: '151px',
    },
    '@media (max-width: 425.98px)': {
      pb: '15px',
      maxWidth: '297px',
      color: ' #1A1C1E',
      fontFamily: 'Golos',
      fontSize: '22px',
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 'normal',
      letterSpacing: '0',
      pt: '0',
    },
  },
  optionText: {
    '@media (max-width: 425.98px)': {
      color: ' #1A1C1E',
      fontFamily: 'Golos',
      fontSize: '15px',
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: '25px',
    },
  },
  button: {
    marginLeft: '-9px',
    maxWidth: '137px',
    display: 'none',
    mt: '32px',
    '@media (max-width: 425.98px)': {
      display: 'inline-block',
    },
  },
};
