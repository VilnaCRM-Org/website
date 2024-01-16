export const textInfoStyles = {
  textWrapper: {
    maxWidth: '43.813rem',
    mb: '50px',

    '@media (max-width: 1439.98px)': {
      mb: '55px',
      ml: '28px',
    },
    '@media (max-width: 639.98px)': {
      mb: '49px',
      ml: '0',
    },
  },
  title: {
    textAlign: 'center',
    '@media (max-width: 639.98px)': {
      color: '#1A1C1E',
      fontFamily: 'Golos',
      fontSize: '32px',
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 'normal',
      textAlign: 'left',
    },
  },
  text: {
    mt: '16px',
    textAlign: 'center',
    mb: '39px',
    '@media (max-width: 639.98px)': {
      mt: '12px',
      mb: '24px',
      textAlign: 'left',
      color: '#1A1C1E',
      fontFamily: 'Golos',
      fontSize: '15px',
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: '25px',
    },
  },
  button: {
    '@media (max-width: 419.98px)': {
      alignSelf: 'baseline',
      marginBottom: '22px',
    },
  },
};
