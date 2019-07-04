let id = \x -> x
let const = \x y -> x
let constid = \x y -> y

type Void = t
let void = \x -> ~Void x

type Unit = t -> t
let Unit = @Unit \x -> x

type Pair a b = (a -> b -> r) -> r
let Pair = \a b -> @Pair \f -> f a b
let casePair = \p -> ~Pair p
let fst = casePair const
let snd = casePair constid

type Sum a b = (a -> r) -> (b -> r) -> r
let L = \x -> @Sum \f g -> f x
let R = \x -> @Sum \f g -> g x
let caseSum = \s -> ~Sum s
