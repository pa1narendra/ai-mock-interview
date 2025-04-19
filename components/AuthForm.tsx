"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {z} from "zod"

import { Button } from "@/components/ui/button"
import {Form} from "@/components/ui/form"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import FormField from "./formField"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/firebase/client"
import { signIn, signUp } from "@/lib/actions/auth.action"



const authFormSchema = (type : FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3).max(30) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(8),
  })
}

const AuthForm = ({type}: {type: FormType}) => {
  const router = useRouter()
  const formSchema = authFormSchema(type)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name : "",
      email: "",
      password: "",
    },
  })
 
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if(type === "sign-in") {
        const {email, password} = values;

        const userCredentials = await signInWithEmailAndPassword(auth, email, password);

        const idToken = await userCredentials.user.getIdToken();


        if(!idToken) {
            toast.error("Invalid credentials");
            return;
        }
        await signIn({email, idToken})

        toast.success("Login Successful.")
        router.push('/');
      }else {
        const {name, email, password} = values;

        const userCredentials = await createUserWithEmailAndPassword(auth, email, password);

        const result = await signUp({
          uid: userCredentials.user.uid,
          name: name!,
          email,
          password,
        })

        if(!result?.success) {
          toast.error(result.message)
          return;
        }
        toast.success("Account Created , continue to login.")
        router.push('/sign-in')
      }
    } catch (error) {
      console.log(error)
      toast.error(`There is an error: ${error}`);
    }
  }

  const isSignIn = type === "sign-in"
  return (
    <div className="card-border lg:min-w-[566px]">
        <div className="flex flex-col gap-6 card py-14 px-10">
            <div className="flex flex-row justify-center gap-2">
                <Image src="/logo.svg" alt="logo" width={32} height={38}/>
                <h2 className="text-primary-100">AI Mock Interview</h2>
            </div>
            <h3 className="text-center">Prepare for your next big tech</h3>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6 m-4 form">
                
                {!isSignIn && (<FormField control={form.control} name="name" label="Name" placeholder="Type your Name"/>)}
                <FormField control={form.control} name="email" label="Email" placeholder="Type your Email" type="email" />
                <FormField control={form.control} name="password" label="Password" placeholder="Type your Password" type="password" />

                <Button className="btn" type="submit">{isSignIn ? 'Sign In' : 'Create an Account'}</Button>
            </form>
            </Form>

            <p className="text-center">{isSignIn ? "Don't have an account?" : 'Already have an account?'}
              <Link href={isSignIn ? '/sign-up' : '/sign-in'} className="font-bold text-user-primary ml-1">{isSignIn ? 'Sign up' : 'Sign in'}</Link>
            </p>
        </div>
    </div>
  )
}

export default AuthForm