(type Void)

(type Unit Unit)

(type (Pair a b) (Pair a b))

(type (Either a b) (Left a) (Right b))

(type (Fix f) (Fix (f (Fix f))))

(let fst (fn p (?Pair p (fn (a b) a))))
(let snd (fn p (?Pair p (fn (a b) b))))

(type (List t) Nil (Cons t (List t)))

(let single (fn x (Cons x Nil)))
(let map (fn (f l) (?List l Nil (fn (h t) (Cons (f h) (map f t))))))
