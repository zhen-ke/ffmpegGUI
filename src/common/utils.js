export const formatDate = (date, format) => {
  const map = {
    MM: date.getMonth() + 1,
    DD: date.getDate(),
    YY: date.getFullYear().toString(),
    hh: date.getHours(),
    mm: date.getMinutes(),
    ss: date.getSeconds(),
  };

  return format.replace(/MM|DD|YY|hh|mm|ss/gi, (matched) => map[matched]);
};
