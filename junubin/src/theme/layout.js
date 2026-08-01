export const layoutForWidth = (width = 393) => {
  const horizontal = width < 360 ? 14 : width < 430 ? 18 : width < 768 ? 22 : 28;
  const maxContentWidth = width >= 768 ? 640 : undefined;
  const maxListWidth = width >= 768 ? 720 : undefined;

  return {
    horizontal,
    maxContentWidth,
    maxListWidth,
    centeredContent: {
      width: '100%',
      maxWidth: maxContentWidth,
      alignSelf: 'center',
    },
    centeredList: {
      width: '100%',
      maxWidth: maxListWidth,
      alignSelf: 'center',
    },
  };
};

export const bottomTabInset = (safeBottom = 0) => safeBottom + 24;
